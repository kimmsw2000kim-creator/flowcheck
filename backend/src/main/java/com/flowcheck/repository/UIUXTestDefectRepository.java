package com.flowcheck.repository;

import com.flowcheck.domain.UIUXTestDefect;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UIUXTestDefectRepository extends JpaRepository<UIUXTestDefect, Long> {
    List<UIUXTestDefect> findByTestRequestId(UUID testRequestId);
    void deleteByTestRequestId(UUID testRequestId);
}
