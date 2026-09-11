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

## Điều khiển ở M2 — kéo vẽ đường chặt

**Bấm giữ trên thân gà rồi kéo một đường thẳng, thả tay là bổ.** Một cử chỉ đặt xong cả ba thông số:

| Thành phần của cử chỉ | Quyết định |
|---|---|
| Điểm bấm xuống | Vị trí nhát dao |
| Hướng kéo | Hướng lưỡi dao |
| Độ dài kéo | Lực bổ (thanh lực hiện ngay dưới màn hình) |

| Phím / chuột | Tác dụng |
|---|---|
| `Q` / `E` | Nghiêng lưỡi dao (mặc định vuông góc thớt) |
| `R` | Đưa lưỡi dao về vuông góc thớt |
| Kéo chuột phải | Xoay camera |

Trong lúc kéo, đường chỉ dao và mặt phẳng cắt **đổi màu theo độ chính xác**: xanh = ngọt
khớp, vàng = sượt khớp, đỏ = sẽ phạm xương. Người chơi chỉnh cho tới khi thấy xanh rồi mới
thả tay — đó là vòng phản hồi chính của bài tập.

Vòng tròn xanh trên thân gà là khớp của bước hiện tại; vạch dọc trong vòng tròn nằm đúng
trong mặt phẳng cắt lý tưởng, kéo dao song song với vạch đó là đúng hướng.

Camera **tự lượn tới khớp** mỗi khi sang bước mới, đứng lệch sang phía trục lưỡi dao để
mặt phẳng cắt hiện ra ở dạng cạnh (nhìn thẳng vào mặt phẳng thì nó phủ kín màn hình và
che mất con gà). Chạm vào chuột là tween huỷ ngay — không bao giờ giành quyền điều khiển
với người chơi. Nút "Đưa camera về khớp" gọi lại khi cần.

## Kiến trúc

```
js/
├── anatomy/chicken-anatomy.json   ← NGUỒN SỰ THẬT DUY NHẤT cho hình học
├── core/      state.js  scoring.js  audio.js
├── render/    scene.js  materials.js  chicken_mesh.js  knife_control.js
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


## Vì sao con gà không trông như nhựa

Bốn thứ cộng lại, thiếu bất kỳ cái nào là hỏng:

1. **Môi trường phản chiếu (IBL).** `scene.environment` lấy từ `RoomEnvironment` qua
   `PMREMGenerator`. Không có nó thì mọi highlight chỉ là một đốm trắng phẳng — mắt người
   đọc ra là nhựa ngay lập tức, dù chỉnh roughness thế nào.
2. **Tone mapping.** `ACESFilmicToneMapping`, exposure 0.95. Không có thì vùng sáng bị cháy trắng.
3. **`MeshPhysicalMaterial` với `sheen` + `clearcoat` mỏng.** sheen cho ánh mềm ở rìa —
   đó chính là thứ phân biệt da với plastic. clearcoat 0.35 / clearcoatRoughness 0.55 là
   lớp mỡ đọng trên mặt da gà luộc để nguội.
4. **Texture procedural** (`js/render/materials.js`, vẽ bằng canvas, không tải ảnh ngoài):
   loang lổ lớn + lỗ chân lông + nếp nhăn, dùng cho cả `map` lẫn `bumpMap`. Một màu phẳng
   tuyệt đối thì không bao giờ ra da.

Ngoài ra hình học được `deform()` đẩy từng đỉnh theo nhiễu fbm — thịt thật không bao giờ
đối xứng tuyệt đối — và `taper()` thu nhỏ dần thân về phía đuôi.

### Hai quy tắc khi chỉnh hình con gà

- **Thân gà là MỘT khối trứng.** `uc` và `lung` phải trùm lên nhau thật sâu. Nếu để chúng
  chỉ chạm nhau thì nhìn ra ngay hai khối chồng lên nhau chứ không phải một con gà.
- **Màu các bộ phận phải gần như đồng nhất.** Chênh lệch sáng tối để cho ánh sáng lo.
  Tô `uc` sáng hơn `lung` một chút thôi là ức lộ thành một mảng dán lên lưng.
