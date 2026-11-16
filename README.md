# 표 붙여넣기 편집기

Jodit 기반 콘텐츠 편집기입니다. Word·Excel·웹의 HTML 표를 붙여넣고 HWP 파일을 가져올 수 있습니다. 편집 내용은 현재 브라우저에 자동 저장되며, HTML 파일로 내려받을 수 있습니다.

## 실행

Node.js와 npm이 필요합니다.

```bash
npm ci
npm run dev:cloudflare
```

출력된 로컬 주소를 브라우저에서 여세요. 이 경로에서는 HWP 5와 HWP 3.0 파일을 브라우저 안에서 변환합니다. 첫 변환 시 WebAssembly 파일 약 10MB를 내려받습니다. `npm run test:cloudflare`로 배포 파일 구성을 확인할 수 있습니다.

Python 서버가 필요한 경우 `python3 server.py`로 `http://127.0.0.1:8765`를 엽니다. 이 서버에서 HWP 5 가져오기를 쓰려면 별도로 설치한 `hwp-cli` 실행 파일의 경로를 `HWP_TOOL` 환경 변수에 지정해야 합니다. HWP 3.0 변환에는 Node.js와 `npm ci`로 설치한 의존성이 필요합니다.

## 기능과 한계

- 글꼴·크기·색상, 단락·정렬·목록, 링크·이미지·표, 이모지, HTML 코드 편집을 지원합니다.
- 클립보드에 HTML 표가 있으면 행·열·병합·주요 테두리와 색상을 보존하도록 처리합니다. HTML이 없는 탭 구분 텍스트는 표로 변환합니다.
- HWP 변환은 본문과 표를 편집 가능한 HTML로 옮깁니다. 페이지 배치·글꼴·그림을 원본과 완전히 같게 재현하지는 않습니다. HWP 3.0은 시험 기능이므로 업무 문서는 원본과 대조하세요.
- 현재 코드는 독립 실행 페이지입니다. 다른 서비스의 작성 화면에 내장하거나 계정별 저장 API에 연결하려면 `src/app.js`의 화면·저장 결합을 분리해야 합니다.
- 브라우저 자동 저장은 해당 브라우저의 로컬 저장소와 IndexedDB를 사용합니다. 서버 계정에 저장되지 않습니다.

## 배포

`npm run build:cloudflare`가 배포할 파일만 `dist/`에 모읍니다. Cloudflare Workers 설정은 `wrangler.jsonc`에 있습니다. `results/`의 개인 문서와 로컬 시험 자료는 Git 및 배포 파일에서 제외합니다.

## 라이선스

프로젝트 자체 코드의 라이선스는 루트의 `LICENSE`를 확인하세요. 포함된 외부 구성 요소의 저작권·라이선스는 `JODIT-LICENSE.txt`, `RHWP-LICENSE.txt`, `RHWP-THIRD-PARTY-LICENSES.md`, `emoji/LICENSE`, `vendor/`의 고지 파일을 확인하세요. 외부 구성 요소를 재배포할 때 해당 고지를 유지해야 합니다.
