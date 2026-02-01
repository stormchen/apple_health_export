import csv
import xml.etree.ElementTree as ET
import sys
import time

# 設定輸入和輸出檔案
INPUT_FILE = 'export.xml'
OUTPUT_FILE = 'health_data_for_gemini.csv'

# 定義你想抓取的欄位
TARGET_TYPES = {
    'HKQuantityTypeIdentifierStepCount',       # 步數
    'HKQuantityTypeIdentifierHeartRate',       # 心率
    'HKCategoryTypeIdentifierSleepAnalysis'    # 睡眠
}

def clean_type_name(type_name):
    """移除前綴，讓名稱更簡潔"""
    if not type_name:
        return ""
    return type_name.replace('HKQuantityTypeIdentifier', '').replace('HKCategoryTypeIdentifier', '')

def process_health_data():
    print(f"開始處理 {INPUT_FILE} ...")
    print("注意：處理大型 XML 檔案可能需要幾分鐘，請耐心等待。")
    
    start_time = time.time()
    count = 0
    exported_count = 0
    
    # 準備 CSV 寫入
    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['type', 'value', 'unit', 'startDate', 'endDate']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()

        # 使用 iterparse 進行串流讀取，避免記憶體溢位
        # events=('end',) 表示在標籤結束時觸發
        context = ET.iterparse(INPUT_FILE, events=('end',))
        
        for event, elem in context:
            if elem.tag == 'Record':
                record_type = elem.get('type')
                
                if record_type in TARGET_TYPES:
                    writer.writerow({
                        'type': clean_type_name(record_type),
                        'value': elem.get('value'),
                        'unit': elem.get('unit'),
                        'startDate': elem.get('startDate'),
                        'endDate': elem.get('endDate')
                    })
                    exported_count += 1
                
                # 重要：清除元素以釋放記憶體
                elem.clear()
                
            # 每處理 100,000 筆資料顯示一次進度
            count += 1
            if count % 100000 == 0:
                print(f"已掃描 {count} 筆記錄... (已匯出: {exported_count})")
                
            # 清除 root 的子元素引用，防止 root 變得巨大
            # 但要保留 root 本身
    
    end_time = time.time()
    duration = end_time - start_time
    
    print(f"\n處理完成！")
    print(f"總耗時: {duration:.2f} 秒")
    print(f"總掃描記錄: {count}")
    print(f"成功匯出資料: {exported_count}")
    print(f"檔案已儲存為: {OUTPUT_FILE}")

if __name__ == '__main__':
    try:
        process_health_data()
    except FileNotFoundError:
        print(f"錯誤: 找不到檔案 {INPUT_FILE}。請確認檔案是否在正確目錄下。")
    except Exception as e:
        print(f"發生未預期的錯誤: {e}")