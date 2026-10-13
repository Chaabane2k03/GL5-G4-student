
FROM eclipse-temurin:17-jre

WORKDIR /app

RUN useradd --system --uid 10001 --create-home appuser

COPY --chown=appuser:appuser target/*.jar app.jar

USER appuser

EXPOSE 8761

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
