import { test, expect } from "@playwright/test";

test("oturum yokken giriş formu açılır", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Giriş yap" })).toBeVisible();
});

test("kayıt: 18 yaş altı veli e-postası ister, KVKK onayı olmadan ilerlemez", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Kayıt ol/ }).click();
  await page.getByPlaceholder("Adın").fill("Deneme");
  await page.getByPlaceholder("Doğum yılın").fill(String(new Date().getFullYear() - 15));
  await expect(page.getByPlaceholder("Veli e-postası")).toBeVisible();
  await page.getByPlaceholder("E-posta").fill("a@b.co");
  await page.getByPlaceholder("Şifre").fill("sifre12345");
  await page.getByPlaceholder("Veli e-postası").fill("veli@b.co");
  await page.getByRole("button", { name: "Hesap aç" }).click();
  await expect(page.getByText("aydınlatma metnini onaylamalısın")).toBeVisible();
});

test("yetişkin doğum yılında veli alanı çıkmaz", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Kayıt ol/ }).click();
  await page.getByPlaceholder("Doğum yılın").fill(String(new Date().getFullYear() - 25));
  await expect(page.getByPlaceholder("Veli e-postası")).toHaveCount(0);
});
