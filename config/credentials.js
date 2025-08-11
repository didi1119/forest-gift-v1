// 配置檔案 - 替代環境變數
// 注意：這是為了免費版 Netlify 的臨時解決方案
// 正式上線時建議使用環境變數

const config = {
  // Google Sheets 配置
  googleSheets: {
    sheetId: '1buMGx7T1SFnOIygylkqQURUDFsHGidXcQ-k3kx3Xmn4',
    clientEmail: 'forest-ambassador@foresthouse-468510.iam.gserviceaccount.com',
    // 私鑰會在部署時動態設定
    privateKey: process.env.GOOGLE_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDBu7t2F9Rqsq7N
13jBN8azJ+8k+SYvtUZLIGnMMFXA4CP8VUE/MiWz4X8Tiu6kG2ABKDPBYhU7eu1v
CBcCfxhiDhVr6LPS1YYs48L5lBbwGv7c8n2YUU+gn8KL/FWLF6MJcs80nr34hLB8
RDtmjBhAc8aeZgegblSpbEJJPgyVkzdJPzEq7BJvbYI4Pv92oREaV126kMIS2X72
H6O5uQJPfhUEX4G6o5Cn4UJzXpYmH7QF7LP4DqJElfd4OGuwgKhvSATjB5/i04R/
Oyhs/lV09aW1pwana6gLCNVWiKHACgDniob3FPOmIkbu+iB5DzIokePkKJ/SmdKl
6yQiRUmNAgMBAAECggEAO1iy+F4caAMMoWncR/Q6Hi+hhoX8OKkjO2hWgIJeApOm
8ml7b0yBWDU/pFDvAb6RDkmucRMGxg3GJjkoM0+TvJXr4f6K948JZz7uP14qGKts
X2q5Jqvh5KaMBi3qVo2LGB3fc5MdRr//AFI2kBdiZnwQ3/0JYQ/rR2sucxla6YaB
9w+VJP73+X900TEfm+jCm4tiYIr4gI/Us4xMRvJIX0XtXkFEnRFaETOccNUkgC9s
WpIsTDRthG1F89txU3T5hAbFiBOBfCjLWT9Osh2nvjhGnE94hAY/OyLfyDJmEyln
VGboCBCPxPyWwXXC1cOwFgoma33jTq+gGbiGNVee0QKBgQD7oS2Zj25f+AaAA8gT
PoiSVK6gXLwUIv2QhRF/snOPoq8jS4dYGeVZHyrSpC8h7ODBESOQUqmZZYgQcvEs
DSLhs2IpijtSA2tt05EGDKm/PF/bsbt5xPrDNLvney0+/aUTgivvkxdTrxuyvJ0V
58nMfHqcXeg2XN/wODePuzKfgwKBgQDFGSEyjoizvFGolC2q6wVI59vf2P5Wkb+b
XEhxahavGPaRXnqUqPshHBleJ9BcijGUHDt1YO9kd64iLGHb1UWjUqsg/ChZtdvG
3vFkAMqXZVE56lboZWO+aW0tx4ns6kmog72cP9HdGgLo5FFBTZrPFHjZLVgLCkUL
eKjrmXGVrwKBgQDxYsQQvJRggdkScw46z9FJtuyyL2PJWWuveMe5nWHYV3L1Q945
ONZX8VsuKIyCWe+dpihcqb/CxLCLPwh2fr+IjoHLYazYVyl2eO91Qy6PooY+hbhX
7wuzuWHMhNB5ze7O0R/+ujc1cxT6GJAE1I80l/EzEa7Sf7PfL5cJnNAqwKBgFug
ohlBv/Vmr8OiF1Tk61EIUORQmXSfTycnkJoBCsid30qXVH81y4GJ8ZUfBzNuHzxO
n6mixce8B5zlaxzqmfQiY2HzN8L001YxoKCv6X7WYBt/gKWLNQJ5OoNUxx73kASi
MgyocqTKCd5A/jFQpY5tYvz7onmHba+2iTj13aMLAoGAJ8E8ru52/rcCF22Cpngs
BB1R4oHw6RmsZddxtDWwInBFoUjQuoTO+tlGzPgRviFbJebK9CxHtuk73UepsojO
XbZKx0qp+WztcqGI8tOKETT6+9v93k8Qwion+anFl4jKVkLj/DSxJaXVhu691Pzh
wPDNBdj0yXYGsFDtjCPs4mo=
-----END PRIVATE KEY-----`
  },

  // Netlify 配置
  netlify: {
    accessToken: process.env.NETLIFY_ACCESS_TOKEN || 'nfp_cxYU84jTiBMztvaWoG7czxtTRCApay2Q1dee'
  },

  // GitHub 配置
  github: {
    repoUrl: process.env.GITHUB_REPO_URL || 'https://github.com/didi1119/forest-gift.git'
  }
};

module.exports = config;