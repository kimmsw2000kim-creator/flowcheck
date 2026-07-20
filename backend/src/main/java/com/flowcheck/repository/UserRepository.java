package com.flowcheck.repository;


import com.flowcheck.domain.User;
import com.flowcheck.domain.UserStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByNicknameIgnoreCase(String nickname);

    boolean existsByNicknameIgnoreCaseAndUserIdNot(String nickname, UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select user from User user where user.email = :email")
    Optional<User> findByEmailForUpdate(@Param("email") String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select user from User user where user.userId = :userId")
    Optional<User> findByIdForUpdate(@Param("userId") UUID userId);

    long countByStatus(UserStatus status);

    long countByCreatedAtGreaterThanEqualAndCreatedAtLessThan(
            OffsetDateTime start,
            OffsetDateTime end
    );
}
