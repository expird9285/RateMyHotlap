# RateMyHotlap 배포 가이드 (Vercel & Oracle Cloud Infrastructure)

본 문서는 RateMyHotlap 프로젝트를 프로덕션 환경에 배포하기 위한 전체 가이드입니다. 
프론트엔드(Next.js)는 Vercel에, 백엔드(FastAPI)는 Oracle Cloud Infrastructure (OCI) 가상 머신(VM)에 배포하는 구조로 작성되었습니다.

---

## 1. 전체 아키텍처 개요

- **프론트엔드**: Vercel (Next.js 16)
- **백엔드**: OCI Compute Instance (Ubuntu 22.04 / Python 3.12 / FastAPI / Gunicorn / Nginx)
- **데이터베이스**: Oracle Autonomous Database (OCI)
- **스토리지**: OCI Object Storage
- **인증**: Supabase Auth

---

## 2. 프론트엔드 배포 (Vercel)

Vercel은 GitHub 저장소와 연동하여 푸시될 때마다 자동 빌드 및 배포를 지원합니다.

### 2.1. Vercel 배포 세팅 단계
1. [Vercel](https://vercel.com) 로그인 후 **"Add New Project"** 클릭
2. RateMyHotlap GitHub 저장소(`expird9285/RateMyHotlap`)를 Import
3. **Configure Project** 
   - **Framework Preset**: `Next.js` (자동 감지됨)
   - **Root Directory**: `frontend` (**매우 중요**: 최상단이 아닌 `frontend` 폴더를 지정해야 함)
   - **Build Command**: 기본값 유지 (`next build`)
   - **Output Directory**: 기본값 유지 (`.next`)

### 2.2. 환경 변수 (Environment Variables) 등록
빌드 전 펼쳐지는 "Environment Variables" 탭에 `.env.local`에 있던 설정을 추가합니다:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase URL 참조
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase API Key 참조
- `NEXT_PUBLIC_API_URL`: **배포할 OCI 백엔드의 주소** (예: `https://api.ratemyhotlap.com`)

### 2.3. ⚠️ 프론트엔드 배포 주의사항
- **Supabase 인증 설정 변경**: Vercel 배포 시 생성된 URL(예: `https://ratemyhotlap.vercel.app`)을 기준으로 Supabase의 `Authentication > URL Configuration`의 **Site URL**과 **Redirect URLs**(`https://ratemyhotlap.vercel.app/*`)를 반드시 변경해야 소셜 로그인이 작동합니다.
- **Google / Discord OAuth**: 각 개발자 콘솔의 "OAuth Callback URL" 등에 Vercel 도메인 리다이렉트 주소를 추가하세요. (`https://.../auth/v1/callback`)
- 모노레포 구조이므로 `Root Directory` 설정을 빼먹으면 빌드에 실패합니다.

---

## 3. 백엔드 배포 (Oracle Cloud Compute)

텔레메트리 파싱 등 연산 작업이 있으므로 OCI의 Always Free 'Arm 기반(A1)' 4코어 24GB RAM 인스턴스를 추천합니다.

### 3.1. OCI VM 프로비저닝 및 기본 설정
1. OCI 콘솔에서 `Compute` > `Instances` > `Create Instance`
2. **OS**: Ubuntu 22.04 LTS
3. **Shape**: `VM.Standard.A1.Flex` (4 OCPU, 24GB Memory - Always Free 등급 권장)
4. SSH 키 (퍼블릭 키 업로드 등)를 등록하고 인스턴스 생성
5. 로컬에서 접속: `ssh ubuntu@<VM_PUBLIC_IP>`
6. **방화벽(Security Lists)** 설정 개방: 
   - OCI VCN(가상 클라우드 네트워크) 설정에서 **80 (HTTP)**, **443 (HTTPS)** 포트 수신(Ingress) 규칙 추가.

### 3.2. 환경 구성 (Python & Git)
VM에 접속하여 필요 패키지를 설치합니다:
```bash
sudo apt update
sudo apt install -y python3-pip python3-venv git nginx
```

프로젝트 클론 및 권한 설정:
```bash
git clone https://github.com/expird9285/RateMyHotlap.git
cd RateMyHotlap/api

# 파이썬 가상환경 설정
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn  # 프로덕션 서빙용 추가 설치
```

### 3.3. DB Wallet 및 환경변수(`.env`) 세팅
로컬 컴퓨터에서 SFTP/SCP 등을 이용해 중요 파일들을 서버로 전송합니다. 
(보안상 GitHub에 올라가지 않은 파일들)
1. `c:\RateMyHotlap\.env` 파일을 서버의 `RateMyHotlap/api/.env` 위치로 이동
2. OCI Database 접속을 위한 지갑 압축 파일(예: `Wallet_*.zip`)을 가져와서 `api/wallet` 디렉토리를 만들고 압축 해제. (`.env` 안의 경로와 맞출 것)

**.env 수정 사항 (서버에서):**
- `CORS_ORIGINS`: Vercel 프론트엔드 주소(`https://ratemyhotlap.vercel.app`)를 쉼표(`,`)로 구분하여 추가.

### 3.4. Gunicorn + Uvicorn 시스템 서비스 (systemd) 등록
서버가 재부팅되거나 에러가 나더라도 백엔드가 상시/자동 실행되도록 `systemd` 로 등록합니다.

```bash
sudo nano /etc/systemd/system/ratemyhotlap-api.service
```
아래 내용 입력 후 저장:
```ini
[Unit]
Description=Gunicorn instance to serve RateMyHotlap API
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/home/ubuntu/RateMyHotlap/api
Environment="PATH=/home/ubuntu/RateMyHotlap/api/venv/bin"
# Gunicorn을 이용해 uvicorn worker 4개로 8000포트 서빙
ExecStart=/home/ubuntu/RateMyHotlap/api/venv/bin/gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000 --timeout 120

[Install]
WantedBy=multi-user.target
```

서비스 실행:
```bash
sudo systemctl start ratemyhotlap-api
sudo systemctl enable ratemyhotlap-api
sudo systemctl status ratemyhotlap-api  # 정상 동작(Active) 확인
```

### 3.5. Nginx 리버스 프록시 및 HTTPS (Let's Encrypt) 세팅
로컬 8000번 포트로 도는 서버를 외부 80/443 포트로 연결(Nginx 리버스 프록시)합니다. Vercel과 안전하게 통신하려면 HTTPS가 필수이므로 도메인이 1개 필요합니다.

```bash
sudo nano /etc/nginx/sites-available/ratemyhotlap-api
```
아래 내용 입력:
```nginx
server {
    listen 80;
    server_name api.본인도메인.com; # 소유한 도메인 입력 (VM의 Public IP로 A레코드 매핑 필요)

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 파일 업로드를 위해 크기 제한 해제 (텔레메트리 파일 크기 대비)
        client_max_body_size 100M;
    }
}
```

Nginx 적용 및 SSL 발급:
```bash
sudo ln -s /etc/nginx/sites-available/ratemyhotlap-api /etc/nginx/sites-enabled/
sudo nginx -t  # 문법 검사 성공 시 아래 진행
sudo systemctl restart nginx

# SSL 인증서 발급
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.본인도메인.com
```

> **💡 Let's Encrypt SSL 인증서 자동 갱신**
> Ubuntu 22.04에서 `apt`로 설치한 certbot은 **systemd 타이머를 통해 자동으로 갱신 프로세스(90일 만료 전 30일 이내에 자동 연장)를 예약**해 둡니다. 
> 
> 아래 시스템 명령어로 타이머가 켜져 있는지 확인할 수 있습니다:
> ```bash
> sudo systemctl status certbot.timer
> ```
> 정상적으로 갱신이 되는지 모의 테스트(Dry Run)를 해보려면 다음을 실행하세요:
> ```bash
> sudo certbot renew --dry-run
> ```

### 3.6. 백엔드 배포 주의사항
- 백엔드에 Vercel 도메인을 `.env`의 `CORS_ORIGINS`에 반드시 추가해야 통신 에러가 나지 않습니다.
- `.ld`나 `.duckdb`는 파일 용량이 클 수 있으므로 **Nginx의 `client_max_body_size` 설정**이 꼭 반영되어야 HTTP 413 (Payload Too Large) 에러를 피할 수 있습니다.
- Arm 아키텍처 인스턴스에서는 `oracledb` 라이브러리의 빌드 이슈를 피하기 위해 `.env` 파일에 `LD_LIBRARY_PATH` 등 불필요한 OS 레벨 의존성을 요구하지 않는 Thin 모드로 구성된 현재 설정을 그대로 유지해야 합니다.
