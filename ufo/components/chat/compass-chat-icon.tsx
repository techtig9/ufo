export function CompassChatIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <path
        d="M4 8a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H14l-6 5v-5H8a4 4 0 0 1-4-4V8Z"
        fill="#D4FF4F"
      />
      <path d="M16 9l2.5 4.5L23 16l-4.5 2.5L16 23l-2.5-4.5L9 16l4.5-2.5L16 9Z" fill="#101114" />
    </svg>
  );
}
