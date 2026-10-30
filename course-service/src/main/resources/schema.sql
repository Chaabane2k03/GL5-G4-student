CREATE TABLE IF NOT EXISTS course (
    id             BIGINT        NOT NULL AUTO_INCREMENT,
    code           VARCHAR(20)   NOT NULL,
    title          VARCHAR(150)  NOT NULL,
    description    TEXT          NULL,
    credits        INT           NOT NULL,
    department_id  BIGINT        NOT NULL,
    status         VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    created_at     DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at     DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uk_course_code UNIQUE (code),
    CONSTRAINT ck_course_credits CHECK (credits BETWEEN 1 AND 30),
    CONSTRAINT ck_course_status CHECK (status IN ('ACTIVE','ARCHIVED')),
    INDEX idx_course_department (department_id),
    INDEX idx_course_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
