package com.flowcheck.dto.uitest;

import lombok.*;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UiTestStartResponse {
    private UUID requestId;
    private String status;
    private String message;
}
