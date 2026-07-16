export const formatDate = (dateString: string) => {
  if (!dateString) return '';

  const date = new Date(dateString);

  // 한국식 날짜 표현 (예: 2026. 7. 14. 오후 4:43)
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};