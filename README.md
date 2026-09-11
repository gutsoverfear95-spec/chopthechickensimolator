# Chặt Gà Sư Phụ

Simulator 3D luyện kỹ năng pha lóc, chặt và xếp gà luộc theo chuẩn Việt Nam.
Chạy thuần trong trình duyệt bằng Three.js — không cần build, không cần server riêng.

## Chạy thử

Vì dùng ES modules và `fetch`, mở thẳng `index.html` bằng `file://` sẽ không chạy.
Cần một HTTP server bất kỳ:

```bash
python3 -m http.server 8000
# rồi mở http://localhost:8000
```

## Ba giai đoạn

| | Module | Nội dung |
|---|---|---|
| **M1** | `js/modules/m1_prep.js` | Chọn gà, buộc dáng, canh lửa luộc, ngâm nước đá |
| **M2** | `js/render/knife_control.js` + `js/core/scoring.js` | Pha lóc theo 7 bước, chấm điểm từng nhát dao |
| **M3** | `js/modules/m3_plating.js` | Kéo thả xếp đĩa, chấm bố cục và tính đối xứng |

## Điều khiển ở M2

| Thao tác | Tác dụng |
|---|---|
| Rê chuột | Đưa dao trên thân gà |
| Giữ & thả chuột trái | Lấy đà rồi bổ (giữ càng lâu lực càng mạnh) |
| Lăn chuột | Xoay hướng lưỡi dao |
| `Q` / `E` | Nghiêng lưỡi dao |
| `R` | Đưa dao về vuông góc thớt |
| Kéo chuột phải | Xoay camera |

Đường chỉ dao đổi màu theo độ chính xác **trước khi** bổ: xanh = ngọt khớp,
vàng = sượt khớp, đỏ = sẽ phạm xương. Vòng tròn xanh trên thân gà là khớp của bước hiện tại.

## Kiến trúc

```
js/
├── anatomy/chicken-anatomy.json   ← NGUỒN SỰ THẬT DUY NHẤT cho hình học
├── core/      state.js  scoring.js  audio.js
├── render/    scene.js  chicken_mesh.js  knife_control.js
├── modules/   m1_prep.js  m2_chop.js  m3_plating.js
└── ui/        ui_analysis.js
```

### Hai quy ước cần nhớ khi sửa code

**1. `chicken-anatomy.json` là nguồn sự thật duy nhất cho hình học.**
Mesh của từng bộ phận được dựng từ trường `mesh` trong file đó, và toạ độ khớp
dùng để chấm điểm cũng lấy từ chính file đó. Đừng bao giờ hard-code toạ độ ở nơi
thứ hai — trước đây mesh và dữ liệu khớp là hai nguồn riêng, và chúng lệch nhau tới
75mm khiến không nhát dao nào có thể trúng.

Thêm một bộ phận mới = thêm một entry vào `parts`, không cần đụng vào code render.

**2. Local space và world space không được lẫn lộn.**

- `chickenMesh.group` chứa phần gà còn dính liền. Group này **xoay được** (nút "Lật Gà").
  Mọi toạ độ trong anatomy JSON là **local** trong group này.
- `chickenMesh.loose` chứa các miếng đã cắt rời. Group này **luôn ở identity transform**,
  tức là local == world — nhờ vậy `DragControls` ở M3 hoạt động đúng.
- Khi cắt rời một miếng, dùng `loose.attach(part)` (không phải `add`) để Three.js
  giữ nguyên transform world, miếng không bị nhảy chỗ.
- Trước khi chấm điểm, điểm chạm dao và hướng dao đều được đổi về local space của
  `group` (xem `KnifeControl.localAngles()` và `worldToLocal`).

### Cách chấm điểm một nhát dao

Một nhát dao là một **mặt phẳng**, không phải một điểm. `scoring.js` đo **khoảng cách
vuông góc từ khớp tới mặt phẳng cắt**, nên việc dao chạm vào mặt ngoài miếng thịt
thay vì tâm khớp không bị tính là sai số.

Điểm ngắm là **giữa dây cung** mà tia nhìn xuyên qua con gà, không phải điểm chạm
mặt ngoài — nếu lấy mặt ngoài thì mọi nhát nhìn nghiêng đều lệch một khoảng đúng
bằng bán kính miếng thịt.

Mặt phẳng thì vô hạn, nên có hai rào chắn:

- `searchRadius` — dao phải ở gần khớp mới được tính là nhắm vào khớp đó.
- `appState.isJointAvailable()` — không cho nhảy cóc sang khớp của bước sau.
  Cần thiết vì khớp vai và đường xương sườn chỉ cách nhau 1 đơn vị và có cùng hướng cắt.

## Thêm một bước vào trình tự pha lóc

1. Thêm khớp vào `joints` trong `chicken-anatomy.json` (`partA` = phần giữ lại,
   `partB` = miếng rời ra).
2. Thêm một entry vào `chopSequence` trong `js/core/state.js`, với `id` trùng key của khớp.

Chỉ vậy. Chỉ báo tiến độ, marker khớp trên thân gà và bảng phân tích cuối lượt tự cập nhật.
