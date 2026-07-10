package com.flowcheck.dto.uiuxtest;

import lombok.*;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UiUxTestStartResponse {
    private UUID requestId;
    private String status;
    private String message;
}
