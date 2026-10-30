package tn.fst.courseservice.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;

/**
 * Uniform error body returned by every failing endpoint.
 *
 * @param timestamp   instant the error was produced
 * @param status      HTTP status code
 * @param error       HTTP reason phrase
 * @param message     human readable message
 * @param path        request URI
 * @param fieldErrors per-field validation errors; empty for non-validation errors
 */
@Schema(description = "Uniform error body returned by every failing endpoint")
public record ErrorResponse(
        @Schema(description = "Instant the error was produced") Instant timestamp,
        @Schema(description = "HTTP status code", example = "400") int status,
        @Schema(description = "HTTP reason phrase", example = "Bad Request") String error,
        @Schema(description = "Human readable message", example = "Validation failed") String message,
        @Schema(description = "Request URI", example = "/api/courses") String path,
        @Schema(description = "Per-field validation errors; empty for non-validation errors")
        List<FieldErrorItem> fieldErrors
) {

    @Schema(description = "A single field-level validation error")
    public record FieldErrorItem(
            @Schema(description = "Field name", example = "code") String field,
            @Schema(description = "Validation message", example = "code must not be blank") String message) {
    }

    public static ErrorResponse of(int status, String error, String message, String path,
                                   List<FieldErrorItem> fieldErrors) {
        return new ErrorResponse(Instant.now(), status, error, message, path, fieldErrors);
    }

    public static ErrorResponse of(int status, String error, String message, String path) {
        return of(status, error, message, path, List.of());
    }
}
