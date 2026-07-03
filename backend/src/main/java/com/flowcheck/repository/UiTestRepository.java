package com.flowcheck.repository;

import com.flowcheck.domain.UiTest;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

public interface UiTestRepository extends JpaRepository<UiTest, UUID> {
}
