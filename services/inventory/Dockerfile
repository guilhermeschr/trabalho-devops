FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /app
COPY services/inventory/pom.xml ./pom.xml
RUN mvn -B dependency:go-offline
COPY services/inventory/src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:24-jre-alpine AS runtime
WORKDIR /app
RUN addgroup -S inventory && adduser -S inventory -G inventory
COPY --from=build /app/target/inventory-service-*.jar app.jar
USER inventory
EXPOSE 3000
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
