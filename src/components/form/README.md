# RequiredFormItem

文本和字符串单选字段的必填项包装，沿用 Ant Design Form 的规则、红框、字段下方错误提示及输入事件。
父级 `a-form` 绑定 `model`，`name` 对应模型字段；提交使用 `@finish`，普通操作按钮先调用 `validateFields`。

```vue
<a-form :model="form" layout="vertical" novalidate @finish="save">
  <RequiredFormItem name="name" label="名称">
    <a-input v-model:value="form.name" />
  </RequiredFormItem>
  <a-button html-type="submit">下一步</a-button>
</a-form>
```

默认提示为“请填写名称”，纯空白也不通过。`message` 可替换为“请选择分类”等文案，`rules` 可追加格式校验；必填规则先执行。
可选字段仍使用 `a-form-item`；布尔确认、数字、数组等字段使用相应类型的 Ant Design 规则，不套用文本必填规则。
