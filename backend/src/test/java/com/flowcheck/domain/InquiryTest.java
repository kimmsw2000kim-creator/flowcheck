package com.flowcheck.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InquiryTest {

    @Test
    @DisplayName("답변 대기 문의는 제목과 내용을 수정할 수 있다")
    void updatesPendingInquiry() {
        Inquiry inquiry = new Inquiry(User.builder().build(), "기존 제목", "기존 내용");

        inquiry.update("수정 제목", "수정 내용");

        assertThat(inquiry.getTitle()).isEqualTo("수정 제목");
        assertThat(inquiry.getContent()).isEqualTo("수정 내용");
    }

    @Test
    @DisplayName("답변 완료 문의는 사용자가 수정할 수 없다")
    void doesNotUpdateAnsweredInquiry() {
        Inquiry inquiry = new Inquiry(User.builder().build(), "기존 제목", "기존 내용");
        inquiry.answer("관리자 답변");

        assertThatThrownBy(() -> inquiry.update("수정 제목", "수정 내용"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("답변 완료된 문의는 수정할 수 없습니다.");
        assertThat(inquiry.getTitle()).isEqualTo("기존 제목");
    }

    @Test
    @DisplayName("관리자는 등록한 답변을 다시 수정할 수 있다")
    void updatesAdminAnswer() {
        Inquiry inquiry = new Inquiry(User.builder().build(), "제목", "내용");
        inquiry.answer("첫 답변");

        inquiry.answer("수정 답변");

        assertThat(inquiry.getStatus()).isEqualTo("ANSWERED");
        assertThat(inquiry.getAnswer()).isEqualTo("수정 답변");
        assertThat(inquiry.getAnsweredAt()).isNotNull();
    }
}
