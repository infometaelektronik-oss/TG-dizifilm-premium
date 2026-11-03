from fake_useragent import UserAgent
from requests import get, exceptions
from bs4 import BeautifulSoup
from sys import argv

def get_data(url, to_update, platform_type):
    headers = {
        "User-Agent": str(UserAgent.chrome),
    }
    try:
        r = get(url, headers=headers, timeout=10)
        if r.status_code != 200:
            return
        
        soup = BeautifulSoup(r.text, 'html.parser')
        
        # Site yapısına göre seçiciler (Gerekirse siteye göre özelleştirilebilir)
        if platform_type == "filmcehennemi":
            items = soup.find_all('div', class_='film-box') # Örnek yapı
            for item in items:
                a_tag = item.find('a')
                if a_tag:
                    link = a_tag.get('href', '')
                    title = a_tag.get('title', 'Bilinmiyor')
                    input_string = f'FilmCehennemi Link: {link}\nTitle: {title}\n\n'.encode(encoding='utf-8')
                    with open(to_update, 'ba') as f1:
                        f1.write(input_string)
                        
        elif platform_type == "kanald":
            # Kanal D dizi arşivi/sayfası için yapı
            items = soup.find_all('div', class_='card-body') # Örnek yapı
            for item in items:
                a_tag = item.find('a')
                if a_tag:
                    link = "https://www.kanald.com.tr" + a_tag.get('href', '')
                    title = a_tag.get('text', '').strip() or "Dizi"
                    input_string = f'Kanal D Dizi Link: {link}\nTitle: {title}\n\n'.encode(encoding='utf-8')
                    with open(to_update, 'ba') as f1:
                        f1.write(input_string)
        
        # Genel fallback tarama (Örnek mantık)
        else:
            for a in soup.find_all('a', href=True):
                if 'dizi' in a['href'] or 'film' in a['href']:
                    link = a['href']
                    title = a.get('title') or a.text.strip()
                    if title and len(title) > 3:
                        input_string = f'Link: {link}\nTitle: {title}\n\n'.encode(encoding='utf-8')
                        with open(to_update, 'ba') as f1:
                            f1.write(input_string)

    except Exception as e:
        print(f"Hata oluştu: {e}")


def fetch_turkish_sources(page_count):
    print("\n\nTürk Yerli Dizi ve Film Siteleri Taranıyor...\n")
    
    with open('yerli_arsiv.txt', 'bw') as f0:
        pass
    
    # Taranacak Türk platformları ve ulusal kanallar listesi
    targets = [
        {"url": "https://www.filmcehennemi.cx/izle/filmler?sayfa=", "type": "filmcehennemi"},
        {"url": "https://www.kanald.com.tr/diziler?page=", "type": "kanald"},
        # İhtiyacına göre Star, Show, Now TV vb. kaynaklar buraya eklenebilir
    ]
    
    for target in targets:
        i = 1
        while i <= page_count:
            try:
                URL = f"{target['url']}{i}"
                print(f"Taranıyor: {URL}")
                get_data(URL, 'yerli_arsiv.txt', target['type'])
                i += 1
            except exceptions.ConnectionError:
                pass


try:
    what = argv[1].lower()
    if what == "yerli":
        pages = int(input("""\n
                        Taranacak sayfa sayısını girin (Varsayılan: 10):
                        """) or 10)
        fetch_turkish_sources(pages)
    else:
        print("""\n\n
            Geçersiz argüman.
            Kullanım: python main.py yerli
    \n\n""")
    
    print("\n\nGüncelleme Tamamlandı!")
        
except Exception as e:
    print(f"""
            Hata: {e}
            Kullanım: python main.py yerli
    """)
