import { PageHeader } from '../../components/common';
import styles from '../../styles/mypage.module.css';

const notificationOptions = [
  { id: 'test-complete', title: '테스트 완료 알림', description: 'AI UI/UX 테스트 또는 부하 테스트가 끝나면 알림을 받습니다.', checked: true },
  { id: 'community', title: '댓글 알림', description: '내 홍보글에 댓글이나 리뷰가 달리면 알림을 받습니다.', checked: true },
  { id: 'payment', title: '결제 알림', description: '크레딧 충전과 결제 상태 변경 알림을 받습니다.', checked: false },
];

function MypageNotificationSettingsSection() {
  return (
    <section className={styles['mypage-section']}>
      <PageHeader
        headingLevel={1}
        eyebrow="NOTIFICATIONS"
        title="알림 설정"
        description="이 설정은 현재 브라우저 세션에서만 유지됩니다."
      />
      <div className={styles['setting-list']}>
        {notificationOptions.map((option) => (
          <label className={styles['setting-row']} htmlFor={option.id} key={option.id}>
            <span>
              <strong>{option.title}</strong>
              <span>{option.description}</span>
            </span>
            <input id={option.id} type="checkbox" defaultChecked={option.checked} />
          </label>
        ))}
      </div>
    </section>
  );
}

export default MypageNotificationSettingsSection;
