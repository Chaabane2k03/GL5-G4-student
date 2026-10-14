package com.eduplatform.course.support;

import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Single, JVM-wide MySQL 8.0 container shared by every test class that needs a database.
 * Started once when this class is first loaded, never restarted per test class.
 */
public final class MySqlTestContainer {

    public static final MySQLContainer<?> INSTANCE =
            new MySQLContainer<>(DockerImageName.parse("mysql:8.0"))
                    .withDatabaseName("course_db")
                    .withUsername("course_user")
                    .withPassword("course_pass");

    static {
        INSTANCE.start();
    }

    private MySqlTestContainer() {
    }
}
