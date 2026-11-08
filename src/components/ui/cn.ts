// 조건부 className을 공백으로 이어 붙인다. (falsy 값은 건너뜀)
// 같은 속성의 유틸리티(예: p-4와 p-6)를 겹쳐 넘기면 어느 쪽이 이길지 보장되지 않으니
// 컴포넌트의 variant/size prop으로 바꾸고 className은 여백·배치 보정에만 쓴다.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
