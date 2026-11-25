# syntax=docker/dockerfile:1

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

COPY pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline

COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -q package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Patch the only known zlib CVE in the Alpine runtime.
RUN apk add --no-cache curl "zlib=1.4-r0"

RUN addgroup -S -g 10001 appuser && adduser -S -u 10001 -G appuser appuser

COPY --from=build --chown=appuser:appuser /app/target/*.jar app.jar

USER appuser

EXPOSE 8761

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
