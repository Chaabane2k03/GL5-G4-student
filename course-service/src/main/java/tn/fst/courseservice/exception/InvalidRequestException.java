package tn.fst.courseservice.exception;

/**
 * Thrown for syntactically valid but semantically rejected request parameters
 * (pagination, sort whitelist, ...). Mapped to HTTP 400.
 */
public class InvalidRequestException extends RuntimeException {

    public InvalidRequestException(String message) {
        super(message);
    }
}
