package com.flowcheck.dto.LoadTest;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LoadTestRequestValidationTest {

    private static jakarta.validation.ValidatorFactory validatorFactory;
    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        validatorFactory = Validation.buildDefaultValidatorFactory();
        validator = validatorFactory.getValidator();
    }

    @AfterAll
    static void closeValidatorFactory() {
        validatorFactory.close();
    }

    @Test
    void acceptsDurationAtMaximum() {
        LoadTestRequest request = validRequest(600);

        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void rejectsDurationAboveMaximum() {
        LoadTestRequest request = validRequest(601);

        assertThat(validator.validate(request))
                .anySatisfy(violation ->
                        assertThat(violation.getPropertyPath().toString()).isEqualTo("duration"));
    }

    private LoadTestRequest validRequest(int duration) {
        LoadTestRequest request = new LoadTestRequest();
        request.setTargetUrl("https://example.com");
        request.setVusers(1);
        request.setDuration(duration);
        return request;
    }
}
