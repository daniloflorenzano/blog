<!--:::{
  "post_title": "Podman com Quadlets em produção",
  "post_description": "Como criar um ambiente de produção com Podman no Linux",
  "post_created_at": "Sun Jun 08 2025 12:06:13 GMT-0300 (Horário Padrão de Brasília)"
}:::-->


Aluguei uma VPS e queria disponibilizar uma API que desenvolvi.

Optei por utilizar contêineres. A escolha do **Podman** foi feita considerando o objetivo de melhorar minha afinidade com a ferramenta e, também, usufruir da integração nativa com o **systemd**.

Para atingir um resultado satisfatório, considerando a inicialização dos contêineres no boot e a possibilidade de acompanhar logs pelo `journalctl`, executei os seguintes passos:

---

1. Criei um pod com os contêineres necessários.

1. Gerei um arquivo YAML para Kubernetes a partir do pod:

    ```bash
    podman generate kube xpto-pod -f /tmp/my_pod_kube.yaml
    ```

1. Criei um arquivo `.kube`, referenciando o `.yaml` gerado:

    **xpto-pod.kube**
    ```
    [Unit]
    Description=Serviço XPTO
    After=network-online.target
    Wants=network-online.target

    [Install]
    WantedBy=multi-user.target

    [Service]
    Restart=on-failure
    RestartSec=5s
    TimeoutStartSec=900

    [Kube]
    Yaml=/tmp/my_pod_kube.yaml
    PublishPort=8080:80
    LogDriver=journald
    SetWorkingDirectory=yaml
    KubeDownForce=true
    ```

    > **Obs**: A seção `[Install]` é essencial para que o systemd inicie o pod automaticamente no boot.

1. Movi o arquivo para a pasta correta:

    ```bash
    sudo mv xpto-pod.kube /etc/containers/systemd/
    ```

1. Recarreguei os serviços do systemd:

    ```bash
    sudo systemctl daemon-reexec
    sudo systemctl daemon-reload
    ```

1. Finalizado! Para verificar se o serviço está em execução:

    ```bash
    systemctl status xpto-pod.service
    ```

---

Continuo explorando formas de usar o **Podman** e suas ferramentas e integrações.

**Fontes que utilizei para alcançar esse resultado:**

- [Quadlets, Pods, and working with the latest Podman, Podman 5](https://www.youtube.com/live/LsZB_mI7TcQ?si=ZKEaWhoXwgrhYves)  
- [Podman: Generate and Play Kubernetes YAML Files](https://oracle-base.com/articles/linux/podman-generate-and-play-kubernetes-yaml-files)  
- [Documentação oficial: podman-systemd.unit](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html)
