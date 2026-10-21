# Base images (overridable: docker build --build-arg MAVEN_IMAGE=... --build-arg JRE_IMAGE=...).
ARG MAVEN_IMAGE=maven:3.9-eclipse-temurin-17
ARG JRE_IMAGE=eclipse-temurin:17-jre-alpine

# ---- Build stage ----
FROM ${MAVEN_IMAGE} AS build
WORKDIR /workspace

COPY pom.xml .
RUN mvn -B -q dependency:go-offline -DskipTests -Dmaven.artifact.threads=1
COPY src ./src
RUN mvn -B -q clean package -DskipTests -Dmaven.artifact.threads=1

# ---- Runtime stage ----
FROM ${JRE_IMAGE}
WORKDIR /app

# Runtime configuration (overridable via --build-arg). Defaults preserve prior behaviour.
ARG SERVER_PORT=8084
ARG APP_USER=app
ARG APP_GROUP=app
ARG JAR_NAME=app.jar
# Context path served by the Config Server (course-service.properties).
ARG CONTEXT_PATH=/course

ENV SERVER_PORT=${SERVER_PORT} \
    APP_USER=${APP_USER} \
    APP_GROUP=${APP_GROUP} \
    JAR_NAME=${JAR_NAME} \
    CONTEXT_PATH=${CONTEXT_PATH} \
    JAVA_OPTS=""

# Run as an unprivileged user.
RUN addgroup -S "$APP_GROUP" && adduser -S "$APP_USER" -G "$APP_GROUP"

COPY --from=build /workspace/target/*.jar ${JAR_NAME}
RUN chown -R "$APP_USER":"$APP_GROUP" /app
USER $APP_USER

EXPOSE ${SERVER_PORT}

HEALTHCHECK --interval=15s --timeout=5s --start-period=45s --retries=10 \
    CMD wget -qO- "http://localhost:${SERVER_PORT}${CONTEXT_PATH}/actuator/health" | grep -q '"status":"UP"' || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar $JAR_NAME"]
