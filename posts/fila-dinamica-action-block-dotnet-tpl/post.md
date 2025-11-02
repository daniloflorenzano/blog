<!--:::{
  "post_title": "Usando ActionBlock como uma Fila Dinâmica Recursiva e Multithread no .NET",
  "post_description": "Uma alternativa melhor ao Parallel.Foreach quando há necessidade de recursão indeterminada",
  "post_created_at": "Sun Nov 02 2025 20:04:22 GMT-0300 (Horário Padrão de Brasília)"
}:::-->

> _“TPL Dataflow é uma mistura interessante de tecnologias assíncronas e paralelas. Ela é útil quando você tem uma sequência de processos que precisam ser aplicados aos seus dados.”_  
> — *Stephen Cleary, Concurrency in C# Cookbook*

---

Recentemente precisei percorrer uma árvore de categorias recursiva — começando com cerca de 20 nós raiz, cada um contendo um número desconhecido de subcategorias (e sub-subcategorias, e assim por diante).

Esse tipo de **carga de trabalho que se expande dinamicamente** não funciona bem com ferramentas de paralelismo estático como `Parallel.ForEach`.

---

## O Problema: Distribuição Estática de Trabalho

Se executarmos um `Parallel.ForEach` nas 20 categorias raiz:

- **Thread 1** pode pegar um ramo pequeno e terminar em 1 segundo.  
- **Thread 2** pode pegar um ramo enorme e levar 10 minutos.  

Mesmo com `MaxDegreeOfParallelism = 50`, a maioria das threads termina cedo e fica ociosa — enquanto algumas ficam presas processando árvores profundas e pesadas.  
**Resultado: desequilíbrio de carga e desperdício de recursos.**

---

## A Solução: `ActionBlock<T>` como Fila de Trabalho Dinâmica

[`ActionBlock<T>`](https://learn.microsoft.com/en-us/dotnet/api/system.threading.tasks.dataflow.actionblock-1), da biblioteca TPL Dataflow, fornece uma **fila centralizada e thread-safe** com **geração dinâmica de tarefas** e **controle de concorrência**.

A ideia é simples:

1. Criar um único `ActionBlock<CategoryNode>` com um limite fixo de concorrência.  
2. “Iniciar” o bloco com as categorias raiz.  
3. Cada worker processa seu nó, encontra as subcategorias e as **reposta** no mesmo `ActionBlock`.  
4. O bloco continua processando até que todos os itens (atuais e pendentes) sejam concluídos.

Esse padrão funciona como uma **fila recursiva e auto-balanceada** — todas as threads permanecem ocupadas até que toda a árvore seja processada.

---

## Exemplo de Implementação

```csharp
public class MultithreadTreeParser
{
    private int _activeItems;
    private ActionBlock<CategoryNode> _actionBlock = null!;

    public async Task<int> StartAsync()
    {
        var rootNode = await GetDepartmentsRootNodeAsync()
            ?? throw new Exception("Falha ao obter nó raiz");

        var options = new ExecutionDataflowBlockOptions
        {
            MaxDegreeOfParallelism = 5
        };

        _actionBlock = new ActionBlock<CategoryNode>(async node =>
        {
            try
            {
                await ProcessCategoryAsync(node);

                var subs = node.SubCategories;
                if (subs.Count > 0)
                {
                    Interlocked.Add(ref _activeItems, subs.Count);
                    foreach (var sub in subs)
                        await _actionBlock.SendAsync(sub);
                }
            }
            finally
            {
                var remaining = Interlocked.Decrement(ref _activeItems);
                if (remaining == 0)
                    _actionBlock.Complete();
            }
        }, options);

        var rootSubs = rootNode.SubCategories;
        Interlocked.Add(ref _activeItems, rootSubs.Count);

        foreach (var sub in rootSubs)
            await _actionBlock.SendAsync(sub);

        await _actionBlock.Completion;
        return 0;
    }
}
```
## Por Que Isso Funciona

- Balanceamento dinâmico de carga: As threads consomem de uma fila compartilhada. Assim que terminam uma tarefa, pegam a próxima disponível.
- Expansão recursiva de trabalho: Cada tarefa pode adicionar novas tarefas de forma segura na mesma fila.
- Paralelismo controlado: MaxDegreeOfParallelism mantém o uso de recursos sob controle.
- Encerramento limpo: _activeItems rastreia o número de tarefas em andamento — quando chega a zero, o pipeline é finalizado de forma ordenada.