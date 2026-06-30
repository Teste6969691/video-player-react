import os

def renomear_videos():
    diretorio = os.getcwd()
    arquivos = os.listdir(diretorio)

    videos = [arquivo for arquivo in arquivos if arquivo.endswith(('.mp4', '.avi', '.mkv'))]

    # Encontrar o número inicial
    numeros_utilizados = set()
    for video in videos:
        partes = video.split('.')
        if len(partes) == 2 and partes[0].startswith('video') and partes[0][5:].isdigit():
            numeros_utilizados.add(int(partes[0][5:]))

    numero_inicial = 1
    while numero_inicial in numeros_utilizados:
        numero_inicial += 1

    for i, video in enumerate(videos, start=numero_inicial):
        nome_original = os.path.join(diretorio, video)
        novo_nome = os.path.join(diretorio, f"video{i}.mp4")

        # Verificar se o próximo número segue a lógica
        while os.path.exists(novo_nome) or (i - numero_inicial) >= len(videos):
            i += 1
            novo_nome = os.path.join(diretorio, f"video{i}.mp4")

        os.rename(nome_original, novo_nome)
        print(f"Renomeando {video} para {novo_nome}")

renomear_videos()   