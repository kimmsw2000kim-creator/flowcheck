import styles from '../../styles/mypage.module.css';
import EmptyState from '../../components/common/EmptyState';

function MypageMyPostsSection() {
    return (
        <section className={styles['mypage-section']}>
            <h1>내 글 · 리뷰</h1>
            <p>작성한 홍보글과 리뷰 활동을 확인할 수 있습니다.</p>

            <EmptyState
                title="작성한 글이나 리뷰가 없습니다."
                description="커뮤니티에 홍보글을 등록하거나 피드백을 남기면 이곳에 표시됩니다."
            />
        </section>
    );
}

export default MypageMyPostsSection;