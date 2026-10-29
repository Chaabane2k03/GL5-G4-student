package tn.fst.courseservice.entity;

/**
 * Lifecycle status of a course.
 *
 * <p>Persisted as a string ({@code @Enumerated(EnumType.STRING)}) and constrained by
 * the {@code ck_course_status} database check constraint.</p>
 */
public enum CourseStatus {
    ACTIVE,
    ARCHIVED
}
