package com.eduplatform.course.service;

import com.eduplatform.course.client.DepartmentClient;
import com.eduplatform.course.dto.CourseRequest;
import com.eduplatform.course.dto.CourseResponse;
import com.eduplatform.course.dto.PageResponse;
import com.eduplatform.course.entity.Course;
import com.eduplatform.course.entity.CourseStatus;
import com.eduplatform.course.exception.CourseNotFoundException;
import com.eduplatform.course.exception.DepartmentNotFoundException;
import com.eduplatform.course.exception.DuplicateCourseCodeException;
import com.eduplatform.course.exception.InvalidRequestException;
import com.eduplatform.course.mapper.CourseMapper;
import com.eduplatform.course.repository.CourseRepository;
import feign.FeignException;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import java.sql.SQLException;
import java.sql.SQLIntegrityConstraintViolationException;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Plain unit tests for {@link CourseServiceImpl}. No Spring context, repository and mapper
 * collaborators are controlled; the mapper under test-collaboration is the real manual mapper.
 */
@ExtendWith(MockitoExtension.class)
class CourseServiceImplTest {

    @Mock
    private CourseRepository courseRepository;

    @Mock
    private DepartmentClient departmentClient;

    private final CourseMapper courseMapper = new CourseMapper();

    private CourseServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new CourseServiceImpl(courseRepository, courseMapper, departmentClient);
    }

    private static CourseRequest request(String code) {
        return new CourseRequest(code, "Title", "Description", 6, 1L);
    }

    private static Course course(Long id, String code, CourseStatus status) {
        return new Course(id, code, "Existing", "desc", 3, 2L, status);
    }

    private static DataIntegrityViolationException duplicateKeyViolation() {
        SQLIntegrityConstraintViolationException sql =
                new SQLIntegrityConstraintViolationException(
                        "Duplicate entry 'CS101' for key 'uk_course_code'", "23000", 1062);
        return new DataIntegrityViolationException("could not execute statement", sql);
    }

    private static DataIntegrityViolationException checkConstraintViolation() {
        SQLException sql = new SQLException("Check constraint 'ck_course_credits' is violated.", "HY000", 3819);
        return new DataIntegrityViolationException("could not execute statement", sql);
    }

    private static DataIntegrityViolationException genericIntegrityViolation() {
        return new DataIntegrityViolationException("some other integrity failure");
    }

    @Nested
    class Create {

        @Test
        void shouldNormalizeCodeTrimAndUpperAndStartActive() {
            when(courseRepository.existsByCode("CS101")).thenReturn(false);
            when(courseRepository.saveAndFlush(any(Course.class))).thenAnswer(invocation -> {
                Course saved = invocation.getArgument(0);
                saved.setId(42L);
                return saved;
            });

            CourseResponse response = service.create(request("  cs101 "));

            assertThat(response.id()).isEqualTo(42L);
            assertThat(response.code()).isEqualTo("CS101");
            assertThat(response.status()).isEqualTo(CourseStatus.ACTIVE);

            ArgumentCaptor<Course> captor = ArgumentCaptor.forClass(Course.class);
            verify(courseRepository).saveAndFlush(captor.capture());
            assertThat(captor.getValue().getCode()).isEqualTo("CS101");
            assertThat(captor.getValue().getStatus()).isEqualTo(CourseStatus.ACTIVE);
            verify(courseRepository).existsByCode("CS101");
        }

        @Test
        void shouldThrowDuplicateCodeWhenCodeAlreadyExists() {
            when(courseRepository.existsByCode("CS101")).thenReturn(true);

            CourseRequest req = request("cs101");
            assertThatThrownBy(() -> service.create(req))
                    .isInstanceOf(DuplicateCourseCodeException.class)
                    .hasMessageContaining("CS101");

            verify(courseRepository, never()).saveAndFlush(any(Course.class));
        }

        @Test
        void shouldThrowDuplicateCodeWhenSaveHitsUniqueKeyRace() {
            when(courseRepository.existsByCode("CS101")).thenReturn(false);
            when(courseRepository.saveAndFlush(any(Course.class))).thenThrow(duplicateKeyViolation());

            CourseRequest req = request("cs101");
            assertThatThrownBy(() -> service.create(req))
                    .isInstanceOf(DuplicateCourseCodeException.class)
                    .hasMessageContaining("CS101");
        }

        @Test
        void shouldRethrowWhenSaveFailsOnCheckConstraintNotDuplicateCode() {
            when(courseRepository.existsByCode("CS101")).thenReturn(false);
            when(courseRepository.saveAndFlush(any(Course.class))).thenThrow(checkConstraintViolation());

            CourseRequest req = request("cs101");
            assertThatThrownBy(() -> service.create(req))
                    .isInstanceOf(DataIntegrityViolationException.class)
                    .isNotInstanceOf(DuplicateCourseCodeException.class)
                    .hasRootCauseMessage("Check constraint 'ck_course_credits' is violated.");
        }

        @Test
        void shouldRethrowGenericIntegrityFailureAsNotDuplicate() {
            when(courseRepository.existsByCode("CS101")).thenReturn(false);
            when(courseRepository.saveAndFlush(any(Course.class))).thenThrow(genericIntegrityViolation());

            CourseRequest req = request("cs101");
            assertThatThrownBy(() -> service.create(req))
                    .isInstanceOf(DataIntegrityViolationException.class)
                    .isNotInstanceOf(DuplicateCourseCodeException.class);
        }

        @Test
        void shouldThrowDepartmentNotFoundWhenCreateReferencesMissingDepartment() {
            when(courseRepository.existsByCode("CS101")).thenReturn(false);
            when(departmentClient.getDepartment(1L)).thenThrow(mock(FeignException.NotFound.class));

            CourseRequest req = request("CS101");
            assertThatThrownBy(() -> service.create(req))
                    .isInstanceOf(DepartmentNotFoundException.class)
                    .hasMessageContaining("1");

            verify(courseRepository, never()).saveAndFlush(any(Course.class));
        }
    }

    @Nested
    class Read {

        @Test
        void shouldReturnCourseWhenFound() {
            when(courseRepository.findById(5L)).thenReturn(Optional.of(course(5L, "CS101", CourseStatus.ACTIVE)));

            CourseResponse response = service.getById(5L);

            assertThat(response.id()).isEqualTo(5L);
            assertThat(response.code()).isEqualTo("CS101");
        }

        @Test
        void shouldThrowNotFoundWhenMissing() {
            when(courseRepository.findById(5L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getById(5L))
                    .isInstanceOf(CourseNotFoundException.class)
                    .hasMessageContaining("5");
        }
    }

    @Nested
    class Update {

        @Test
        void shouldUpdateFieldsAndKeepStatusAndNormalizeCode() {
            Course existing = course(5L, "CS101", CourseStatus.ACTIVE);
            when(courseRepository.findById(5L)).thenReturn(Optional.of(existing));
            when(courseRepository.existsByCodeAndIdNot("CS101", 5L)).thenReturn(false);
            when(courseRepository.saveAndFlush(any(Course.class))).thenAnswer(invocation -> invocation.getArgument(0));

            CourseResponse response = service.update(5L,
                    new CourseRequest(" cs101 ", "New title", "New desc", 9, 7L));

            assertThat(response.code()).isEqualTo("CS101");
            assertThat(response.title()).isEqualTo("New title");
            assertThat(response.description()).isEqualTo("New desc");
            assertThat(response.credits()).isEqualTo(9);
            assertThat(response.departmentId()).isEqualTo(7L);
            assertThat(response.status()).isEqualTo(CourseStatus.ACTIVE);
            verify(courseRepository).existsByCodeAndIdNot("CS101", 5L);
        }

        @Test
        void shouldAllowKeepingOwnCode() {
            Course existing = course(5L, "CS101", CourseStatus.ACTIVE);
            when(courseRepository.findById(5L)).thenReturn(Optional.of(existing));
            when(courseRepository.existsByCodeAndIdNot("CS101", 5L)).thenReturn(false);
            when(courseRepository.saveAndFlush(any(Course.class))).thenAnswer(invocation -> invocation.getArgument(0));

            CourseResponse response = service.update(5L, request("CS101"));

            assertThat(response.code()).isEqualTo("CS101");
        }

        @Test
        void shouldThrowDuplicateWhenChangingToAnotherCourseCode() {
            when(courseRepository.findById(5L)).thenReturn(Optional.of(course(5L, "CS101", CourseStatus.ACTIVE)));
            when(courseRepository.existsByCodeAndIdNot("CS102", 5L)).thenReturn(true);

            CourseRequest req = request("cs102");
            assertThatThrownBy(() -> service.update(5L, req))
                    .isInstanceOf(DuplicateCourseCodeException.class)
                    .hasMessageContaining("CS102");

            verify(courseRepository, never()).saveAndFlush(any(Course.class));
        }

        @Test
        void shouldThrowNotFoundWhenUpdatingMissingCourse() {
            when(courseRepository.findById(9L)).thenReturn(Optional.empty());

            CourseRequest req = request("CS101");
            assertThatThrownBy(() -> service.update(9L, req))
                    .isInstanceOf(CourseNotFoundException.class);

            verify(courseRepository, never()).existsByCodeAndIdNot(anyString(), any());
        }

        @Test
        void shouldThrowDuplicateWhenUpdateHitsUniqueKeyRace() {
            when(courseRepository.findById(5L)).thenReturn(Optional.of(course(5L, "CS101", CourseStatus.ACTIVE)));
            when(courseRepository.existsByCodeAndIdNot("CS102", 5L)).thenReturn(false);
            when(courseRepository.saveAndFlush(any(Course.class))).thenThrow(duplicateKeyViolation());

            CourseRequest req = request("CS102");
            assertThatThrownBy(() -> service.update(5L, req))
                    .isInstanceOf(DuplicateCourseCodeException.class);
        }

        @Test
        void shouldAllowUpdatingArchivedCourseWithoutChangingStatus() {
            Course archived = course(5L, "CS101", CourseStatus.ARCHIVED);
            when(courseRepository.findById(5L)).thenReturn(Optional.of(archived));
            when(courseRepository.existsByCodeAndIdNot("CS101", 5L)).thenReturn(false);
            when(courseRepository.saveAndFlush(any(Course.class))).thenAnswer(invocation -> invocation.getArgument(0));

            CourseResponse response = service.update(5L, request("CS101"));

            assertThat(response.status()).isEqualTo(CourseStatus.ARCHIVED);
        }

        @Test
        void shouldThrowDepartmentNotFoundWhenUpdateReferencesMissingDepartment() {
            when(courseRepository.findById(5L)).thenReturn(Optional.of(course(5L, "CS101", CourseStatus.ACTIVE)));
            when(courseRepository.existsByCodeAndIdNot("CS101", 5L)).thenReturn(false);
            when(departmentClient.getDepartment(1L)).thenThrow(mock(FeignException.NotFound.class));

            CourseRequest req = request("CS101");
            assertThatThrownBy(() -> service.update(5L, req))
                    .isInstanceOf(DepartmentNotFoundException.class)
                    .hasMessageContaining("1");

            verify(courseRepository, never()).saveAndFlush(any(Course.class));
        }
    }

    @Nested
    class Archive {

        @Test
        void shouldArchiveActiveCourse() {
            Course active = course(5L, "CS101", CourseStatus.ACTIVE);
            when(courseRepository.findById(5L)).thenReturn(Optional.of(active));
            when(courseRepository.saveAndFlush(any(Course.class))).thenAnswer(invocation -> invocation.getArgument(0));

            service.archive(5L);

            assertThat(active.getStatus()).isEqualTo(CourseStatus.ARCHIVED);
            verify(courseRepository).saveAndFlush(active);
        }

        @Test
        void shouldBeIdempotentWhenArchivingTwice() {
            Course archived = course(5L, "CS101", CourseStatus.ARCHIVED);
            when(courseRepository.findById(5L)).thenReturn(Optional.of(archived));
            when(courseRepository.saveAndFlush(any(Course.class))).thenAnswer(invocation -> invocation.getArgument(0));

            service.archive(5L);
            service.archive(5L);

            assertThat(archived.getStatus()).isEqualTo(CourseStatus.ARCHIVED);
            verify(courseRepository, times(2)).saveAndFlush(archived);
        }

        @Test
        void shouldThrowNotFoundWhenArchivingMissingCourse() {
            when(courseRepository.findById(5L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.archive(5L))
                    .isInstanceOf(CourseNotFoundException.class);
        }
    }

    @Nested
    class Activate {

        @Test
        void shouldActivateArchivedCourse() {
            Course archived = course(5L, "CS101", CourseStatus.ARCHIVED);
            when(courseRepository.findById(5L)).thenReturn(Optional.of(archived));
            when(courseRepository.saveAndFlush(any(Course.class))).thenAnswer(invocation -> invocation.getArgument(0));

            CourseResponse response = service.activate(5L);

            assertThat(response.status()).isEqualTo(CourseStatus.ACTIVE);
        }

        @Test
        void shouldBeIdempotentWhenActivatingTwice() {
            Course active = course(5L, "CS101", CourseStatus.ACTIVE);
            when(courseRepository.findById(5L)).thenReturn(Optional.of(active));
            when(courseRepository.saveAndFlush(any(Course.class))).thenAnswer(invocation -> invocation.getArgument(0));

            service.activate(5L);
            CourseResponse response = service.activate(5L);

            assertThat(response.status()).isEqualTo(CourseStatus.ACTIVE);
            verify(courseRepository, times(2)).saveAndFlush(active);
        }

        @Test
        void shouldThrowNotFoundWhenActivatingMissingCourse() {
            when(courseRepository.findById(5L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.activate(5L))
                    .isInstanceOf(CourseNotFoundException.class);
        }
    }

    @Nested
    class ListCourses {

        private Page<Course> pageOf(Course... courses) {
            return new PageImpl<>(List.of(courses), PageRequest.of(0, 20, Sort.by(Sort.Direction.ASC, "code")),
                    courses.length);
        }

        @Test
        void shouldMapPageMetadataAndContent() {
            when(courseRepository.findAll(any(Specification.class), any(Pageable.class)))
                    .thenReturn(pageOf(course(1L, "CS101", CourseStatus.ACTIVE), course(2L, "CS102", CourseStatus.ACTIVE)));

            PageResponse<CourseResponse> response = service.list(null, null, 0, 20, "code,asc");

            assertThat(response.content()).extracting(CourseResponse::code).containsExactly("CS101", "CS102");
            assertThat(response.page()).isZero();
            assertThat(response.size()).isEqualTo(20);
            assertThat(response.totalElements()).isEqualTo(2);
            assertThat(response.totalPages()).isEqualTo(1);
            assertThat(response.first()).isTrue();
            assertThat(response.last()).isTrue();
        }

        @Test
        @SuppressWarnings("unchecked")
        void shouldApplyDefaultSortWhenSortIsNull() {
            when(courseRepository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(pageOf());

            service.list(null, null, 0, 20, null);

            ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
            verify(courseRepository).findAll(any(Specification.class), captor.capture());
            assertThat(captor.getValue().getSort().getOrderFor("code")).isNotNull();
            assertThat(captor.getValue().getSort().getOrderFor("code").getDirection())
                    .isEqualTo(Sort.Direction.ASC);
        }

        @Test
        void shouldApplyDefaultSortWhenSortIsBlank() {
            when(courseRepository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(pageOf());

            service.list(null, null, 0, 20, "  ");

            ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
            verify(courseRepository).findAll(any(Specification.class), captor.capture());
            assertThat(captor.getValue().getSort().getOrderFor("code")).isNotNull();
        }

        @Test
        void shouldApplyRequestedSortAndPagination() {
            when(courseRepository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(pageOf());

            service.list(null, null, 2, 5, "credits,desc");

            ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
            verify(courseRepository).findAll(any(Specification.class), captor.capture());
            Pageable pageable = captor.getValue();
            assertThat(pageable.getPageNumber()).isEqualTo(2);
            assertThat(pageable.getPageSize()).isEqualTo(5);
            assertThat(pageable.getSort().getOrderFor("credits").getDirection()).isEqualTo(Sort.Direction.DESC);
        }

        @Test
        void shouldSupportEachFilterCombination() {
            when(courseRepository.findAll(any(Specification.class), any(Pageable.class))).thenReturn(pageOf());

            service.list(null, null, 0, 20, "code,asc");
            service.list(1L, null, 0, 20, "code,asc");
            service.list(null, CourseStatus.ACTIVE, 0, 20, "code,asc");
            service.list(1L, CourseStatus.ARCHIVED, 0, 20, "code,asc");

            verify(courseRepository, times(4)).findAll(any(Specification.class), any(Pageable.class));
        }

        @Test
        void shouldRejectNegativePage() {
            assertThatThrownBy(() -> service.list(null, null, -1, 20, "code,asc"))
                    .isInstanceOf(InvalidRequestException.class)
                    .hasMessageContaining("page");
        }

        @Test
        void shouldRejectSizeAboveMaximum() {
            assertThatThrownBy(() -> service.list(null, null, 0, 101, "code,asc"))
                    .isInstanceOf(InvalidRequestException.class)
                    .hasMessageContaining("size");
        }

        @Test
        void shouldRejectSizeBelowMinimum() {
            assertThatThrownBy(() -> service.list(null, null, 0, 0, "code,asc"))
                    .isInstanceOf(InvalidRequestException.class)
                    .hasMessageContaining("size");
        }

        @Test
        void shouldRejectUnknownSortField() {
            assertThatThrownBy(() -> service.list(null, null, 0, 20, "name,asc"))
                    .isInstanceOf(InvalidRequestException.class)
                    .hasMessageContaining("name");
        }

        @Test
        void shouldRejectInvalidSortDirection() {
            assertThatThrownBy(() -> service.list(null, null, 0, 20, "code,sideways"))
                    .isInstanceOf(InvalidRequestException.class)
                    .hasMessageContaining("direction");
        }

        @Test
        void shouldRejectTooManySortParts() {
            assertThatThrownBy(() -> service.list(null, null, 0, 20, "code,asc,extra"))
                    .isInstanceOf(InvalidRequestException.class)
                    .hasMessageContaining("sort");
        }
    }

    @Nested
    class Specifications {

        @SuppressWarnings("unchecked")
        @Test
        void departmentFilterShouldBeConjunctionWhenNull() {
            Root<Course> root = mock(Root.class);
            CriteriaQuery<?> query = mock(CriteriaQuery.class);
            CriteriaBuilder cb = mock(CriteriaBuilder.class);
            Predicate predicate = mock(Predicate.class);
            when(cb.conjunction()).thenReturn(predicate);

            Predicate result = CourseServiceImpl.hasDepartmentId(null).toPredicate(root, query, cb);

            assertThat(result).isSameAs(predicate);
        }

        @SuppressWarnings("unchecked")
        @Test
        void departmentFilterShouldCompareDepartmentIdWhenPresent() {
            Root<Course> root = mock(Root.class);
            CriteriaQuery<?> query = mock(CriteriaQuery.class);
            CriteriaBuilder cb = mock(CriteriaBuilder.class);
            Path<Object> path = mock(Path.class);
            Predicate predicate = mock(Predicate.class);
            when(root.get("departmentId")).thenReturn(path);
            when(cb.equal(path, 7L)).thenReturn(predicate);

            Predicate result = CourseServiceImpl.hasDepartmentId(7L).toPredicate(root, query, cb);

            assertThat(result).isSameAs(predicate);
        }

        @SuppressWarnings("unchecked")
        @Test
        void statusFilterShouldBeConjunctionWhenNull() {
            Root<Course> root = mock(Root.class);
            CriteriaQuery<?> query = mock(CriteriaQuery.class);
            CriteriaBuilder cb = mock(CriteriaBuilder.class);
            Predicate predicate = mock(Predicate.class);
            when(cb.conjunction()).thenReturn(predicate);

            Predicate result = CourseServiceImpl.hasStatus(null).toPredicate(root, query, cb);

            assertThat(result).isSameAs(predicate);
        }

        @SuppressWarnings("unchecked")
        @Test
        void statusFilterShouldCompareStatusWhenPresent() {
            Root<Course> root = mock(Root.class);
            CriteriaQuery<?> query = mock(CriteriaQuery.class);
            CriteriaBuilder cb = mock(CriteriaBuilder.class);
            Path<Object> path = mock(Path.class);
            Predicate predicate = mock(Predicate.class);
            when(root.get("status")).thenReturn(path);
            when(cb.equal(path, CourseStatus.ACTIVE)).thenReturn(predicate);

            Predicate result = CourseServiceImpl.hasStatus(CourseStatus.ACTIVE).toPredicate(root, query, cb);

            assertThat(result).isSameAs(predicate);
        }
    }

    @Nested
    class DuplicateDetection {

        @Test
        void shouldRethrowWhenSqlIntegrityViolationHasNonDuplicateErrorCode() {
            SQLIntegrityConstraintViolationException sql =
                    new SQLIntegrityConstraintViolationException("Foreign key constraint fails", "23000", 1452);
            DataIntegrityViolationException ex =
                    new DataIntegrityViolationException("could not execute statement", sql);
            when(courseRepository.existsByCode("CS101")).thenReturn(false);
            when(courseRepository.saveAndFlush(any(Course.class))).thenThrow(ex);

            CourseRequest req = request("cs101");
            assertThatThrownBy(() -> service.create(req))
                    .isInstanceOf(DataIntegrityViolationException.class)
                    .isNotInstanceOf(DuplicateCourseCodeException.class);
        }

        @Test
        void shouldRethrowWhenCauseMessageIsNull() {
            DataIntegrityViolationException ex =
                    new DataIntegrityViolationException("wrapper", new RuntimeException());
            when(courseRepository.existsByCode("CS101")).thenReturn(false);
            when(courseRepository.saveAndFlush(any(Course.class))).thenThrow(ex);

            CourseRequest req = request("cs101");
            assertThatThrownBy(() -> service.create(req))
                    .isInstanceOf(DataIntegrityViolationException.class)
                    .isNotInstanceOf(DuplicateCourseCodeException.class);
        }

        @Test
        void shouldDetectDuplicateFromMessageWithoutNamedConstraint() {
            DataIntegrityViolationException ex =
                    new DataIntegrityViolationException("stmt",
                            new RuntimeException("Duplicate entry 'CS101' for key 'PRIMARY'"));
            when(courseRepository.existsByCode("CS101")).thenReturn(false);
            when(courseRepository.saveAndFlush(any(Course.class))).thenThrow(ex);

            CourseRequest req = request("cs101");
            assertThatThrownBy(() -> service.create(req))
                    .isInstanceOf(DuplicateCourseCodeException.class);
        }
    }

    @Nested
    class CodeNormalization {

        @Test
        void shouldTrimAndUppercase() {
            assertThat(CourseServiceImpl.normalizeCode("  cs101 ")).isEqualTo("CS101");
        }

        @Test
        void shouldReturnNullForNullInput() {
            assertThat(CourseServiceImpl.normalizeCode(null)).isNull();
        }
    }

    @Nested
    class SortParsing {

        @Test
        void shouldDefaultToCodeAscendingForNull() {
            Sort sort = CourseServiceImpl.parseSort(null);
            assertThat(sort.getOrderFor("code").getDirection()).isEqualTo(Sort.Direction.ASC);
        }

        @Test
        void shouldParseFieldOnlyAsAscending() {
            Sort sort = CourseServiceImpl.parseSort("title");
            assertThat(sort.getOrderFor("title").getDirection()).isEqualTo(Sort.Direction.ASC);
        }

        @Test
        void shouldParseFieldAndDescendingDirection() {
            Sort sort = CourseServiceImpl.parseSort("credits,desc");
            assertThat(sort.getOrderFor("credits").getDirection()).isEqualTo(Sort.Direction.DESC);
        }

        @Test
        void shouldRejectUnknownField() {
            assertThatThrownBy(() -> CourseServiceImpl.parseSort("updatedAt,asc"))
                    .isInstanceOf(InvalidRequestException.class);
        }
    }
}
