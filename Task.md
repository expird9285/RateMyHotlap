# 구현 태스크 목록

## 1차 우선순위

- 프로젝트 리포지토리 구조 확정: `frontend`, `api`, `importer`, `worker`, `shared-types` 분리 .
- OCI Always Free 환경 준비: API 서버 배포 대상, Autonomous Database 생성, Object Storage 버킷 생성 .
- Supabase 프로젝트 생성: 소셜 로그인 제공자만 활성화하고 이메일/비밀번호 로그인 비활성화 .
- 기본 환경변수 체계 정의: Supabase URL/Key, OCI DB 접속 정보, Object Storage 자격증명, LLM API Key .
- 공통 도메인 타입 정의: `User`, `Lap`, `Telemetry`, `AIAnalysis`, `ShareCode`, `ImportJob`, `RawFile`, `NormalizedLap` .

## 백엔드 코어

- 인증 미들웨어 구현: 프론트에서 받은 Supabase JWT 검증 후 내부 `users` upsert .
- DB 스키마 작성: `users`, `raw_files`, `import_jobs`, `laps`, `telemetry`, `ai_analysis`, `share_codes` 생성 .
- 파일 업로드 API 구현: 텔레메트리 파일 필수, ACC 셋업 파일 선택 업로드 지원 .
- 원본 파일 저장 로직 구현: 업로드 직후 SHA-256 계산, Object Storage 저장, `raw_files` 레코드 생성 .
- Import Job 큐/상태 관리 구현: `pending`, `processing`, `success`, `failed`, `partial_success` 전이 처리 .

## Importer 모듈

- ACC `.ld` importer 연동 준비 및 기본 파서 골격 구성 .
- ACC `.ld` importer 구현: MoTeC 파서 연동, Lap Beacon 기준 랩 분리, 채널 표준화 .
- LMU `.duckdb` importer 골격 구현: `Inspector`, `ChannelMapper`, `LapBuilder`, `DerivedMetrics`, `ImportReport` 모듈 분리 .
- Import 결과 저장 로직 구현: 선택된 랩만 `laps`와 `telemetry`에 저장 .
- 실패 허용 정책 구현: 필수 채널 누락은 실패, 선택 채널 누락은 경고와 부분 성공 처리 .

## 프론트엔드

- 로그인 화면 구현: Supabase OAuth 버튼만 노출 .
- 대시보드 구현: 내 랩/친구 랩 탭, 게임·트랙·차량·날짜 필터, 검색 .
- 업로드 화면 구현: 파일 선택, 진행 상태, Import 경고/누락 채널 표시 .
- 단일 랩 분석 화면 구현: 속도·스로틀·브레이크·스티어·RPM 그래프, 시간축/트랙위치축 전환 .
- 비교 화면 구현: delta time, 오버레이 그래프, 공유 코드 생성/조회 .

## AI 분석과 운영

- 단일 랩 전처리 구현: 코너 자동 분리, 코너별 요약 지표 생성, 전체 통계 생성 .
- ACC 셋업 반영 로직 구현: 핵심 셋업값만 추출해 프롬프트에 포함 .
- 비교 랩 AI 분석 구현: 두 랩을 spline 기준 정렬 후 차이 요약 생성 .
- AI 결과 캐시 구현: 동일 랩 재분석 전 저장된 결과 우선 반환, 수동 재분석 버튼 별도 처리 .
- 공유 코드 운영 구현: 8자리 코드 생성, 만료일, 조회수 증가, 비로그인 비교 허용 .

## 추천 개발 순서

1. 인증 + DB + 원본 파일 저장부터 끝낸다 .  
2. 그다음 ACC `.ld` importer와 단일 랩 뷰를 먼저 완성해 **최소 동작 제품**을 만든다 .  
3. 이후 LMU `.duckdb`, 비교 뷰, AI 분석 순으로 붙이면 리스크가 큰 기능을 단계적으로 검증할 수 있다 .