# Build stage: compile and package the Spring Boot jar
FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app

# Cache dependencies first
COPY pom.xml .
RUN mvn -q -B dependency:go-offline

# Then copy sources and build (test sources skipped: coverage lives in src/test)
COPY src ./src
RUN mvn -q -B package -Dmaven.test.skip=true

# Run stage: minimal JRE image
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Patch the only known zlib CVE in the Alpine runtime.
RUN apk add --no-cache "zlib=1.4-r0"
COPY --from=build /app/target/config-server-0.0.1-SNAPSHOT.jar /app/config-server.jar

RUN addgroup -S config && adduser -S -G config config \
    && chown -R config:config /app
USER config

EXPOSE 8071
ENTRYPOINT ["java", "-jar", "/app/config-server.jar"]