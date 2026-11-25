# syntax=docker/dockerfile:1
# Build context is the repository root (see docker-compose.yml).

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

COPY department-service/pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline

COPY department-service/src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -q package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Patch the only known zlib CVE in the Alpine runtime.
RUN apk add --no-cache "zlib=1.4-r0"

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8082

ENTRYPOINT ["java", "-jar", "app.jar"]
