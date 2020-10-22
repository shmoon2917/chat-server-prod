# Chat Server

카카오톡 HVO 메신저봇을 위한 REST API 서버
Google Firebase Functions 를 사용하여 serverless 환경 구축

## Installation

npm 으로 firebase CLI 설치 및 depency 설치

```bash
npm install -g firebase-tools

npm install
```

## Usage

1. Google Client ID와 Secret, Oauth callback url 설정

2. serve 명령어로 로컬 환경 실행, deploy로 프로덕션 환경 배포

```bash
firebase serve --only functions, hosting

firebase deploy
```
