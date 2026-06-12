# Báo Cáo Challenge: Ship Smartly

---

## 1. Yêu cầu 1: Mọi cấu hình chuẩn GitOps

**Mô tả:** 
Toàn bộ hệ thống được khai báo bằng mã nguồn (Infrastructure as Code) thông qua các file YAML và được quản lý tập trung trên GitHub. ArgoCD đóng vai trò tự động đồng bộ (sync) mọi thay đổi từ GitHub về cụm Kubernetes mà không cần gõ lệnh cấu hình thủ công.
Các file cấu hình chính bao gồm:
- `rollout.yaml`: Cấu hình chiến thuật triển khai Canary.
- `analysis.yaml`: Cấu hình kịch bản đo lường tự động (AnalysisTemplate).
- `alert.yaml`: Cấu hình cảnh báo Prometheus Rule.
- `kube-prometheus-stack.yaml`: Cấu hình hệ thống giám sát và AlertManager.

---

## 2. Yêu cầu 2: Giải thích Cấu hình Cảnh Báo (SLO & Alert về Email)

### 2.1 Định nghĩa SLO (Service Level Objective)

Trong bài Lab này, **SLO (Mục tiêu chất lượng dịch vụ)** được định nghĩa là: **"Tỉ lệ lỗi 500 của toàn bộ hệ thống phải luôn được giữ ở mức DƯỚI 5% trong mọi thời điểm."**

Để đo lường và bảo vệ SLO này, mình sử dụng câu lệnh PromQL sau trong `AnalysisTemplate`:

```promql
sum(rate(flask_http_request_total{status="500", namespace="default"}[2m])) 
/ 
sum(rate(flask_http_request_total{namespace="default"}[2m]))
```

**Giải thích cơ chế bảo vệ SLO:**
- Câu lệnh này tính **tỉ lệ phần trăm các request bị lỗi (mã 500)** trên tổng số tất cả các request trong vòng 2 phút qua. 
- **Ngưỡng an toàn (Threshold):** `successCondition: result < 0.05` (Đúng với định nghĩa SLO ở trên). Nếu tỉ lệ lỗi vượt qua 5% (Vi phạm SLO), hệ thống `AnalysisTemplate` sẽ lập tức đánh lỗi (Failed) và Argo Rollouts sẽ tự động huỷ bỏ quá trình cập nhật.

  <img width="1861" height="920" alt="image" src="https://github.com/user-attachments/assets/3153046f-6495-4da3-9f55-a7944177a2c7" />


### 2.2 Cấu hình Cảnh báo (PrometheusRule)
Để AlertManager phát hiện và gửi Email, mình định nghĩa `PrometheusRule`:

```yaml
    - alert: HighErrorRate
      expr: sum(rate(flask_http_request_total{status="500"}[1m])) / sum(rate(flask_http_request_total[1m])) > 0.05
      for: 1m
      labels:
        severity: critical
```
**Giải thích:**
- Câu lệnh này tính **tỉ lệ phần trăm các request bị lỗi (mã 500)** trên tổng số tất cả các request trong vòng 2 phút qua.
- Nếu tỉ lệ này tăng lên, nghĩa là phiên bản mới đang gây ra sự cố.

### Ngưỡng giới hạn (Threshold) để huỷ Canary
- **Ngưỡng thiết lập:** `successCondition: result < 0.05`
- **Ý nghĩa:** Tỉ lệ request bị lỗi phải **nhỏ hơn 5%** (tức là 95% request phải thành công). 
- Nếu tỉ lệ lỗi vượt qua 5%, `AnalysisTemplate` sẽ trả về thất bại (Failed). Argo Rollouts sẽ dựa vào đó để tự động **Abort** (huỷ bỏ) bản cập nhật và tự động quay xe về phiên bản cũ an toàn.

---

## 3. Yêu cầu 3: Bằng chứng Canary Tự Động "Quay Xe" (Auto-abort)

**Mô tả bước thực hiện:**
Khi phiên bản mới (được cố tình cài cắm lỗi `ERROR_RATE: "0.5"`) được đẩy lên, Argo Rollouts điều hướng 25% traffic cho bản Canary. Lúc này, tiến trình `AnalysisTemplate` bắt đầu chạy ngầm để truy vấn Prometheus. Phát hiện tỉ lệ lỗi vượt ngưỡng 5%, hệ thống lập tức tự động **Abort** (huỷ lệnh nâng cấp) và trả 100% traffic về phiên bản cũ để bảo vệ người dùng, không cần con người can thiệp.

<img width="1291" height="144" alt="image" src="https://github.com/user-attachments/assets/147aa24d-25f6-4073-a865-ec7ff5380927" />

<img width="1263" height="117" alt="image" src="https://github.com/user-attachments/assets/e2980bbc-f1a9-4f9c-b533-ffbcd0c84b6e" />

---

## 4. Yêu cầu 4: Bằng chứng Rollback siêu tốc qua Git

**Mô tả bước thực hiện:**
Mặc dù hệ thống đã tự động huỷ bản lỗi để bảo vệ người dùng, nhưng phiên bản lỗi vẫn còn tồn tại trên GitHub. Để dọn dẹp triệt để chuẩn GitOps, mình thực hiện lệnh `git revert` để quay ngược lịch sử commit về trạng thái an toàn trước đó, rồi `git push` lên GitHub.
Chỉ vài giây sau, hệ thống ArgoCD tự động nhận diện commit khôi phục này và đồng bộ (Sync) lại toàn bộ cụm K8s về trạng thái xanh lá (Healthy) hoàn hảo dưới 5 phút.

<img width="728" height="330" alt="image" src="https://github.com/user-attachments/assets/3d1fae45-bb19-4f36-97d5-d294e0d3d1cf" />

<img width="1605" height="772" alt="image" src="https://github.com/user-attachments/assets/bdfe240f-7f2c-45c1-8b25-3e05aff99f82" />
