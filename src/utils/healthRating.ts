export function getHealthRating(percentage: number): { label: string; color: string } {
  if (percentage >= 85) return { label: 'Excellent', color: '#27ae60' };
  if (percentage >= 70) return { label: 'Good', color: '#2ecc71' };
  if (percentage >= 50) return { label: 'Average', color: '#f39c12' };
  if (percentage >= 30) return { label: 'Fair', color: '#d35400' };
  return { label: 'Poor', color: '#c0392b' };
}
