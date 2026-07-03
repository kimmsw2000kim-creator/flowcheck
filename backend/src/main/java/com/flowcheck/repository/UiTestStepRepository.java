package com.flowcheck.repository;

import com.flowcheck.domain.UiTest;
import com.flowcheck.domain.UiTestStep;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface UiTestStepRepository extends JpaRepository<UiTestStep, Long> {
    List<UiTestStep> findByUiTestOrderByStepAsc(UiTest uiTest);
}
