import { uniqueNamesGenerator } from "unique-names-generator";

const adjectives = [
  "부끄러운",
  "차분한",
  "꼼꼼한",
  "용감한",
  "느긋한",
  "명랑한",
  "성실한",
  "기민한",
  "따뜻한",
  "조용한",
  "유쾌한",
  "신중한",
  "반짝이는",
  "튼튼한",
  "다정한",
  "날렵한",
];

const nouns = [
  "원숭이",
  "고래",
  "여우",
  "판다",
  "수달",
  "참새",
  "고양이",
  "강아지",
  "다람쥐",
  "돌고래",
  "알파카",
  "펭귄",
  "코알라",
  "호랑이",
  "토끼",
  "부엉이",
];

export function generateNickname() {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, nouns],
    length: 2,
    separator: " ",
  });
}
