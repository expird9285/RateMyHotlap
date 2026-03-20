# Oracle Cloud Infrastructure (OCI) 세팅 가이드

RateMyHotlap 백엔드 및 파일 저장을 위해 Oracle Cloud의 평생 무료(Always Free) 자원을 세팅하는 가이드입니다. 세팅 완료 후 필요한 자격증명(Wallet 파일 등)과 환경 변수들을 향후 앱에 연결하게 됩니다.

> 💡 **진행 전 체크**: OCI 회원가입 시 결제 수단 확인(신용카드/체크카드)이 필요하지만, Always Free 자원만 생성하면 요금이 청구되지 않습니다. 가입 후 콘솔(https://cloud.oracle.com)에 로그인해 주세요.

---

## 1. Autonomous Database (ADB) 생성

관계형 데이터베이스(사용자 및 랩타임 데이터 등 메타데이터 저장)로 사용될 인스턴스를 생성합니다.

1. **메뉴 이동**: 좌측 햄버거 메뉴 ≡ > **Oracle Database** > **Autonomous Data Warehouse** 또는 **Autonomous Transaction Processing** 클릭. (일반적으로 Transaction Processing 권장)
2. **생성 버튼 클릭**: `Create Autonomous Database` 버튼 클릭.
3. **기본 정보 입력**:
   - **Display Name**: `RateMyHotlap_DB` (원하는 이름)
   - **Database Name**: `ratemyhotlapdb`
4. **옵션 선택**:
   - **Workload Type**: `Transaction Processing`
   - **Deployment Type**: `Serverless`
   - **⚡ Always Free 토글**: **"Always Free"** 스위치를 **반드시 켭니다(ON)**. (이후 하단의 CPU/Storage 옵션이 무료 사양으로 고정됩니다.)
5. **관리자 계정(ADMIN) 설정**:
   - **Password**: `직접 지정한 강력한 비밀번호` **(앱 연동 시 필요하므로 반드시 메모해 두세요!)**
6. **네트워크 접속 설정 (Network Access)**:
   - `Secure access from everywhere` (모든 위치에서 보안 액세스)를 선택하거나, 필요한 IP만 허용하도록 세팅할 수 있습니다. 로컬 개발을 위해 초반에는 everywhere가 편합니다.
7. **생성 완료**: 하단의 `Create Autonomous Database` 버튼을 클릭합니다. (생성까지 수 분 소요)
8. 🔐 **Wallet(지갑) 파일 다운로드**:
   - 생성 완료 후 해당 DB 상세 페이지에서 **Database Connection(데이터베이스 접속)** 버튼을 클릭.
   - **Download Wallet**을 클릭하고, 다운로드 비밀번호를 입력한 후 `.zip` 지갑 파일을 다운로드합니다. 이 파일은 나중에 서버가 DB에 안전하게 접속하기 위해 필수적입니다.

---

## 2. Object Storage 버킷 생성

텔레메트리 원본 파일(`.ld`, `.duckdb` 등)을 영구적으로 저장할 평생 무료 클라우드 스토리지를 생성합니다.

1. **메뉴 이동**: 좌측 햄버거 메뉴 ≡ > **Storage** > **Buckets** 클릭.
2. **생성 버튼 클릭**: `Create Bucket` 버튼 클릭.
3. **속성 설정**:
   - **Bucket Name**: `ratemyhotlap-raw` (원하는 이름)
   - **Default Storage Tier**: `Standard` (Always Free 기본 지원 대상)
   - 나머지 체크박스는 기본값으로 두고 **Create** 클릭.
4. 🔐 **API 자격증명(S3 호환 / OCI Native) 발급**:
   - OCI 콘솔 우측 상단의 **사용자 프로필 아이콘** 클릭 > **내 프로필(My Profile)**.
   - 좌측 하단 메뉴 중 **Customer Secret Keys(비밀 키)** 클릭 > `Generate Secret Key`.
   - 키 이름을 `ratemyhotlap`로 짓고 발급.
   - **생성된 Secret Key(비밀 키)** 문자열과, 화면에 보이는 **Access Key(액세스 키)** 문자열을 복사해서 메모해 둡니다. 이는 Object Storage 접근 시 필요합니다.

---

## ✅ 세팅 완료 후 수집해야 할 정보 목록

설정이 끝났다면 아래 정보가 모두 준비되었는지 확인해 주세요. 이 정보들은 나중에 `.env` 파일에 기입하여 코딩할 때 사용합니다.

- [ ] **DB 관리자 비밀번호** (ADMIN 계정에 쓰이는 암호)
- [ ] **DB Wallet `.zip` 파일** (로컬에 다운로드 완료)
- [ ] **Object Storage 네임스페이스** (Bucket 상세 페이지에서 확인 가능한 Namespace 문자열)
- [ ] **Object Storage Access Key** 
- [ ] **Object Storage Secret Key**

가이드에 따라 세팅을 진행해 주시고, 완료되시거나 궁금한 점이 있으면 말씀해 주세요!
