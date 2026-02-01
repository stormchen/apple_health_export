# Apple Health 資料分析專案

本專案旨在處理和分析 Apple Health 的匯出資料 (`export.xml`)。透過 Python 腳本將大型 XML 檔案轉換為易於處理的 CSV 格式，並進行數據分析與視覺化（如每日步數趨勢圖）。

## 📁 檔案結構

*   **`export.xml`**: Apple Health 原始匯出檔案（**注意**：檔案較大，約 1GB）。
*   **`apple_health_export.py`**: 資料轉換腳本。
    *   功能：使用串流解析 (Streaming Parsing) 讀取 XML，提取步數、心率和睡眠資料。
    *   輸出：`health_data_for_gemini.csv`
*   **`analysis.py`**: 資料分析與繪圖腳本。
    *   功能：讀取 CSV，計算每日總步數，並繪製趨勢折線圖。
    *   輸出：`daily_step_trend.png`、終端機統計資訊。
*   **`health_data_for_gemini.csv`**: 轉換後的結構化資料。
*   **`daily_step_trend.png`**: 每日步數趨勢分析圖表。

## 🚀 如何使用

### 1. 安裝必要套件

請確保已安裝 Python 3，並於終端機執行以下指令安裝依賴庫：

```bash
pip install pandas matplotlib numpy python-dateutil
```

### 2. 執行資料轉換

將 `export.xml` 轉換為 CSV：

```bash
python apple_health_export.py
```
> **提示**：由於 XML 檔案較大，轉換過程可能需要 1-2 分鐘。腳本會每處理 10 萬筆資料顯示一次進度。

### 3. 執行分析與繪圖

生成步數趨勢圖與統計數據：

```bash
python analysis.py
```

執行後，您將在目錄下看到生成的 `daily_step_trend.png`圖片。

## 📊 分析結果摘要

截至最新一次的分析執行：

*   **資料涵蓋範圍**: 約 7.2 年 (2,635 天)
*   **總累積步數**: 22,662,423 步
*   **平均每日步數**: 8,600 步
*   **單日最高紀錄**: 71,962 步 (發生於 2024-05-19)

---
*Created by Antigravity*
