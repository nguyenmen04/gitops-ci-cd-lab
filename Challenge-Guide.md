# Hướng Dẫn Chi Tiết Làm Challenge: Ship Smartly

Bài hướng dẫn này giúp bạn từng bước hoàn thành Challenge cuối khoá.

---

## Bước 1: Viết bài kiểm tra tự động (AnalysisTemplate)

Thay vì bạn phải tự nhìn biểu đồ Prometheus, chúng ta sẽ viết một cái "đề kiểm tra" để máy tự động nhìn biểu đồ.

1. Tạo một file mới tên là `k8s/backend/analysis.yaml`.
2. Dán nội dung sau vào:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: error-rate-check
  namespace: default
spec:
  metrics:
  - name: error-rate
    successCondition: len(result) == 0 || result[0] < 0.05
    failureLimit: 1
    provider:
      prometheus:
        address: http://kube-prometheus-stack-prometheus.monitoring:9090
        query: |
          sum(rate(flask_http_request_total{status="500", namespace="default"}[1m])) 
          / 
          sum(rate(flask_http_request_total{namespace="default"}[1m]))
```
*Giải thích:* Nó sẽ hỏi Prometheus xem tỉ lệ lỗi 500 là bao nhiêu. Nếu tỉ lệ < 0.05 (5%) hoặc không có lỗi nào (len = 0) thì ĐẠT. Nếu lỗi quá nhiều, rớt.

---

## Bước 2: Lắp bài kiểm tra vào quá trình Canary (Auto-abort)

Giờ ta gắn bài kiểm tra vào quy trình ra mắt bản mới.

1. Mở file `k8s/backend/rollout.yaml`.
2. Sửa lại phần `strategy` ở cuối file thành như sau:

```yaml
  strategy:
    canary:
      steps:
        - setWeight: 25
        - analysis:
            templates:
            - templateName: error-rate-check
        - pause: {duration: 10s} 
```
*Giải thích:* Khi có bản mới, nó lên 25%. Sau đó nó đứng lại làm bài kiểm tra `error-rate-check`. 
- Nếu ĐẠT: Nghỉ 10s rồi tự chạy lên 100%.
- Nếu RỚT: Tự động huỷ (Abort) và về bản cũ!

---

## Bước 3: Cấu hình AlertManager gửi Email

1. Bạn cần lấy **Mật khẩu ứng dụng (App Password)** của Gmail (Vào Tài khoản Google -> Bảo mật -> Xác minh 2 bước -> Mật khẩu ứng dụng).
2. Mở file `argocd-apps/kube-prometheus-stack.yaml`, thêm cấu hình `alertmanager` vào khối `values` (nhớ lùi lề cẩn thận):

```yaml
    helm:
      values: |
        alertmanager:
          config:
            global:
              smtp_smarthost: 'smtp.gmail.com:587'
              smtp_from: 'email-cua-ban@gmail.com'
              smtp_auth_username: 'email-cua-ban@gmail.com'
              smtp_auth_password: 'mat-khau-ung-dung-o-buoc-1'
              smtp_require_tls: true
            route:
              receiver: 'my-email'
              group_by: ['alertname']
            receivers:
            - name: 'my-email'
              email_configs:
              - to: 'email-cua-ban@gmail.com'
        prometheus:
          prometheusSpec:
            serviceMonitorSelectorNilUsesHelmValues: false
            ruleSelectorNilUsesHelmValues: false
```

---

## Bước 4: Viết luật cảnh báo (PrometheusRule)

Để Prometheus biết khi nào thì gửi Email, bạn phải dạy nó.

1. Tạo file `k8s/backend/alert.yaml`.
2. Dán đoạn này vào:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: high-error-rate-alert
  namespace: default
  labels:
    release: kube-prometheus-stack
spec:
  groups:
  - name: gitops-backend.rules
    rules:
    - alert: HighErrorRate
      expr: sum(rate(flask_http_request_total{status="500"}[1m])) / sum(rate(flask_http_request_total[1m])) > 0.05
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "App đang dính lỗi rất cao!"
        description: "Tỉ lệ lỗi 500 đang vượt quá 5% trong 1 phút qua."
```

---

## Bước 5: Chạy thử và Quay Clip nộp bài

1. Lưu tất cả các file vừa tạo. Push code lên GitHub (`git add .`, `git commit`, `git push`).
2. Mở ArgoCD và chờ nó Sync xong (hoặc tự gõ lệnh push).
3. **Mô phỏng lỗi:** Mở `k8s/backend/rollout.yaml`, sửa biến môi trường `ERROR_RATE` thành `"0.5"` (tỉ lệ lỗi 50%) và đổi `VERSION` thành `"v3"`. Push lên GitHub lần nữa.
4. **Quay clip:** Mở sẵn màn hình Terminal gõ lệnh `kubectl get rollout gitops-backend -n default -w`. Bạn sẽ thấy nó chạy lên 25%, kiểm tra thấy lỗi, báo **Degraded/Aborted** và tự rớt về v2.
5. Chờ 1 phút, kiểm tra Email, chụp lại màn hình Email cảnh báo!
