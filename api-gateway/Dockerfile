# syntax=docker/dockerfile:1
# Build context is the repository root (see docker-compose.yml).

FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

COPY api-gateway/pom.xml .
RUN --mount=type=cache,target=/root/.m2 mvn -B -q dependency:go-offline

COPY api-gateway/src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B -q package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8072

ENTRYPOINT ["java", "-jar", "app.jar"]

