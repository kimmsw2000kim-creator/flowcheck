package com.flowcheck.repository;


import com.flowcheck.domain.User;
import com.flowcheck.domain.UserStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    long countByStatus(UserStatus status);

    long countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(
            OffsetDateTime start,
            OffsetDateTime end
    );
}
