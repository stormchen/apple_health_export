import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

# 設定檔案路徑
INPUT_CSV = 'health_data_for_gemini.csv'
OUTPUT_IMAGE = 'daily_step_trend.png'

def plot_step_trend():
    print("正在讀取 CSV 資料...")
    # 讀取 CSV，確保日期欄位被正確解析
    df = pd.read_csv(INPUT_CSV)
    
    # 篩選出步數資料
    print("篩選步數資料中...")
    df_steps = df[df['type'] == 'StepCount'].copy()
    
    # 轉換 startDate 為 datetime 物件
    df_steps['startDate'] = pd.to_datetime(df_steps['startDate'])
    
    # 轉換 value 為數值 (有些可能是浮點數或字串)
    df_steps['value'] = pd.to_numeric(df_steps['value'], errors='coerce')
    
    # 依據日期 (YYYY-MM-DD) 進行分組並加總
    # 我們使用 startDate 的日期部分作為索引
    print("正在計算每日步數...")
    daily_steps = df_steps.groupby(df_steps['startDate'].dt.date)['value'].sum()
    
    # 開始繪圖
    print("正在繪製圖表...")
    plt.figure(figsize=(12, 6))
    
    # 設定中文字型 (嘗試使用微軟正黑體，若無則使用預設)
    plt.rcParams['font.sans-serif'] = ['Microsoft JhengHei', 'Arial Unicode MS', 'SimHei'] 
    plt.rcParams['axes.unicode_minus'] = False
    
    ax = daily_steps.plot(kind='line', color='#2E86C1', linewidth=2)
    
    # 標題與標籤
    plt.title('每日步數趨勢圖 (Daily Step Count)', fontsize=16, fontweight='bold')
    plt.xlabel('日期', fontsize=12)
    plt.ylabel('步數', fontsize=12)
    plt.grid(True, linestyle='--', alpha=0.7)
    
    # 填滿線下區域，增加視覺效果
    plt.fill_between(daily_steps.index, daily_steps.values, color='#AED6F1', alpha=0.3)
    
    # 顯示平均線
    avg_steps = daily_steps.mean()
    plt.axhline(y=avg_steps, color='r', linestyle='--', label=f'平均步數: {int(avg_steps)}')
    plt.legend()
    
    # 儲存圖片
    plt.tight_layout()
    plt.savefig(OUTPUT_IMAGE, dpi=300)
    print(f"圖表已儲存為: {OUTPUT_IMAGE}")
    
    # 顯示一些統計數據
    print("\n--- 步數統計 ---")
    print(f"資料天數: {len(daily_steps)} 天")
    print(f"總步數: {int(daily_steps.sum()):,}")
    print(f"平均每日步數: {int(avg_steps):,}")
    print(f"最高單日步數: {int(daily_steps.max()):,} ({daily_steps.idxmax()})")

if __name__ == '__main__':
    try:
        plot_step_trend()
    except Exception as e:
        print(f"發生錯誤: {e}")
