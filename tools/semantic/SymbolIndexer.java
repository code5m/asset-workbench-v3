import com.sun.source.tree.*;
import com.sun.source.util.*;
import javax.lang.model.element.*;
import javax.tools.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.stream.*;

/**
 * JDK compiler semantic indexer: -proc:none, parse+attribute only; NEVER
 * executes project code, compiles output classes or launches Maven scripts.
 * Produces one JSON object per line; calls without proven target are unresolved.
 */
public final class SymbolIndexer {
  private static String json(String text) {
    if (text == null) text = "";
    StringBuilder out = new StringBuilder("\"");
    for (int i = 0; i < text.length(); i++) {
      char c = text.charAt(i);
      if (c == '"' || c == '\\') out.append('\\').append(c);
      else if (c == '\n') out.append("\\n");
      else if (c == '\r') out.append("\\r");
      else if (c == '\t') out.append("\\t");
      else if (c < 32) out.append(String.format("\\u%04x", (int) c));
      else out.append(c);
    }
    return out.append('"').toString();
  }
  private static String symbol(ExecutableElement method) {
    Element parent = method.getEnclosingElement();
    if (!(parent instanceof TypeElement type)) return "";
    String params = method.getParameters().stream()
      .map(p -> p.asType().toString()).collect(Collectors.joining(","));
    return type.getQualifiedName() + "#" + method.getSimpleName() + "(" + params + ")";
  }
  private static void emit(PrintWriter output, String kind, String file, long line,
                           String signature, String label) {
    output.println("{\"kind\":" + json(kind) + ",\"file\":" + json(file)
      + ",\"line\":" + line + ",\"symbol\":" + json(signature)
      + ",\"label\":" + json(label) + "}");
  }
  public static void main(String[] args) throws Exception {
    if (args.length != 2) throw new IllegalArgumentException("usage: <source-root> <output.jsonl>");
    Path root = Path.of(args[0]).toRealPath();
    Path result = Path.of(args[1]).toAbsolutePath();
    JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
    if (compiler == null) throw new IllegalStateException("JDK JavaCompiler not present");
    List<Path> files;
    try (Stream<Path> walk = Files.walk(root)) {
      files = walk.filter(p -> Files.isRegularFile(p, LinkOption.NOFOLLOW_LINKS) && p.toString().endsWith(".java"))
        .sorted().collect(Collectors.toList());
    }
    if (files.size() > 6000) throw new IllegalStateException("Java source cap exceeded");
    Files.createDirectories(result.getParent());
    try (PrintWriter output = new PrintWriter(Files.newBufferedWriter(result, StandardCharsets.UTF_8));
         StandardJavaFileManager manager = compiler.getStandardFileManager(null, Locale.ROOT, StandardCharsets.UTF_8)) {
      if (files.isEmpty()) { emit(output, "status", "", 0, "", "no Java input"); return; }
      DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
      Iterable<? extends JavaFileObject> input = manager.getJavaFileObjectsFromPaths(files);
      JavacTask task = (JavacTask) compiler.getTask(null, manager, diagnostics,
        List.of("-proc:none", "-implicit:none", "-Xlint:none", "-encoding", "UTF-8"), null, input);
      List<CompilationUnitTree> units = new ArrayList<>();
      for (CompilationUnitTree unit : task.parse()) units.add(unit);
      try { task.analyze(); }
      catch (RuntimeException error) {
        emit(output, "diagnostic", "", 0, "", "attribution stopped: " + error.getClass().getSimpleName());
      }
      Trees trees = Trees.instance(task);
      for (CompilationUnitTree unit : units) {
        Path filePath = Path.of(unit.getSourceFile().toUri()).toRealPath();
        if (!filePath.startsWith(root)) continue;
        String relative = root.relativize(filePath).toString().replace('\\', '/');
        new TreePathScanner<Void, Void>() {
          long line(Tree node) {
            long pos = trees.getSourcePositions().getStartPosition(unit, node);
            return pos < 0 ? 0 : unit.getLineMap().getLineNumber(pos);
          }
          @Override public Void visitClass(ClassTree node, Void ignored) {
            Element element = trees.getElement(getCurrentPath());
            if (element instanceof TypeElement type)
              emit(output, "class", relative, line(node), type.getQualifiedName().toString(), node.getSimpleName().toString());
            return super.visitClass(node, ignored);
          }
          @Override public Void visitMethod(MethodTree node, Void ignored) {
            Element element = trees.getElement(getCurrentPath());
            if (element instanceof ExecutableElement method)
              emit(output, "method", relative, line(node), symbol(method), node.getName().toString());
            else emit(output, "unresolved-definition", relative, line(node), "", node.getName().toString());
            return super.visitMethod(node, ignored);
          }
          @Override public Void visitMethodInvocation(MethodInvocationTree node, Void ignored) {
            Element element = trees.getElement(getCurrentPath());
            if (element instanceof ExecutableElement method)
              emit(output, "call", relative, line(node), symbol(method), node.getMethodSelect().toString());
            else emit(output, "unresolved-call", relative, line(node), "", node.getMethodSelect().toString());
            return super.visitMethodInvocation(node, ignored);
          }
        }.scan(unit, null);
      }
      int errors = 0;
      for (Diagnostic<? extends JavaFileObject> diag : diagnostics.getDiagnostics()) {
        if (diag.getKind() == Diagnostic.Kind.ERROR && ++errors <= 120) {
          String message = diag.getCode() + ": " + diag.getMessage(Locale.ROOT);
          emit(output, "diagnostic", "", diag.getLineNumber(), "", message.substring(0, Math.min(message.length(), 250)));
        }
      }
      emit(output, "status", "", files.size(), "", "java_files=" + files.size() + ";compiler_errors=" + errors);
    }
  }
}
