FROM eclipse-temurin:17-jre

WORKDIR /app
COPY student-service/target/student-service.jar app.jar

EXPOSE 8085

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
