# backend/Dockerfile

# ======================================================================
#  1. Build Stage: 소스코드를 컴파일하여 .jar 파일을 만드는 단계
# ======================================================================

# Gradle과 JDK 17이 모두 포함된 이미지를 'builder'라는 별명의 빌드 환경으로 사용
FROM eclipse-temurin:21-jdk-jammy AS builder
WORKDIR /app

COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN sed -i 's/\r$//' gradlew && chmod +x gradlew

COPY src ./src
RUN ./gradlew clean bootJar -x test --no-daemon

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
