package com.flowcheck.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import org.hibernate.annotations.ColumnDefault;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users", schema = "public")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @NotNull
    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @NotNull
    @ColumnDefault("0")
    @Column(nullable = false)
    private Integer balance;

    @NotNull
    @ColumnDefault("'USER'")
    @Column(nullable = false, length = 20)
    private String role;

    @NotNull
    @ColumnDefault("'ACTIVE'")
    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "suspended_until")
    private OffsetDateTime suspendedUntil;

    @NotNull
    @ColumnDefault("now()")
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

}
