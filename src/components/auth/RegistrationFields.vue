<script setup lang="ts">
import type { UserRegisterReqDTO } from '@/types/user'
defineProps<{ form: UserRegisterReqDTO; external?: boolean }>()
</script>
<template>
  <a-form-item name="username" label="用户名" :rules="[{required:true,message:'请输入用户名'},{min:4,max:20,message:'用户名为4–20个字符'},{pattern:/^[a-zA-Z0-9_]+$/,message:'仅允许字母、数字、下划线'}]"><a-input v-model:value="form.username" autocomplete="username" :maxlength="20" placeholder="你的 Verse 用户名" /></a-form-item>
  <a-form-item name="nickname" label="昵称（可选）" :rules="[{max:50,message:'昵称不能超过50个字符'}]"><a-input v-model:value="form.nickname" autocomplete="nickname" :maxlength="50" placeholder="希望大家如何称呼你" /></a-form-item>
  <a-form-item name="password" :label="external ? 'Verse 登录密码' : '密码'" :rules="[{required:true,message:'请输入密码'},{min:8,max:32,message:'密码为8–32个字符'}]"><a-input-password v-model:value="form.password" autocomplete="new-password" :maxlength="32" placeholder="8–32个字符" /><small v-if="external">为 Verse 设置独立密码，无需填写外部平台密码。</small></a-form-item>
  <a-form-item name="email" label="联系邮箱" :rules="[{required:true,message:'请输入邮箱'},{type:'email',message:'请输入有效邮箱'},{max:100,message:'邮箱不能超过100个字符'}]"><a-input v-model:value="form.email" type="email" autocomplete="email" :maxlength="100" placeholder="example@email.com" /></a-form-item>
  <a-form-item name="phone" label="手机号" :rules="[{required:true,message:'请输入手机号'},{pattern:/^1[3-9]\d{9}$/,message:'请输入有效手机号'}]"><a-input v-model:value="form.phone" type="tel" autocomplete="tel" :maxlength="11" placeholder="用于账户联系与密码找回" /></a-form-item>
</template>
<style lang="scss" scoped>small { color: $color-text-secondary; font-size: 11px; }</style>
