// Hiển thị chuỗi có <b>…</b> hoặc <em>…</em> thành thẻ React (không dùng innerHTML -> an toàn với tên người dùng nhập).
export default function Rich({ text }) {
  const parts = String(text).split(/(<b>.*?<\/b>|<em>.*?<\/em>)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (p.startsWith('<b>')) return <b key={i}>{p.slice(3, -4)}</b>;
    if (p.startsWith('<em>')) return <em key={i}>{p.slice(4, -5)}</em>;
    return <span key={i}>{p}</span>;
  });
}